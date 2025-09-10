// ia/generativeAI.js

/**
 * Módulo de IA Generativa
 * Gera respostas em tempo real, naturais e contextuais usando OpenAI
 */

const axios = require('axios'); // Mantido caso seja usado em outro lugar, mas não para OpenAI
const OpenAI = require('openai'); // Importa a biblioteca OpenAI

// REMOVA ESTA LINHA: const gameMemoryService = require('../modules/gameMemoryService');
// REMOVA ESTA LINHA: const gameMemoryService = require('../modules/gameMemoryService');
// REMOVA ESTA LINHA: const GameMemoryServiceClass = require('../modules/gameMemoryService'); 
// Essas linhas são de debug e não são necessárias no código final.

class GenerativeAI {
    // --- MODIFICAÇÃO: Adiciona gameMemoryService como parâmetro no construtor ---
    constructor(config, twitchClient, memoryManager = null, gameMemoryService = null) { 
        this.config = config; 
        this.twitchClient = twitchClient;
        this.memoryManager = memoryManager; 
        this.gameMemoryService = gameMemoryService; // Armazena a instância do GameMemoryService

        // --- MODIFICAÇÃO: Inicializa o cliente OpenAI usando a API Key do ambiente ---
        // A chave 'OPENAI_API_KEY' deve estar configurada no seu arquivo .env
        if (!process.env.OPENAI_API_KEY) {
            console.error('ERRO: Variável de ambiente OPENAI_API_KEY não encontrada. A IA não funcionará.');
            // Você pode optar por lançar um erro ou desativar a IA aqui
            this.isActive = false; 
            this.openaiClient = null;
        } else {
            this.openaiClient = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY
            });
        }
        // --- FIM MODIFICAÇÃO ---

        // REMOVIDO: this.apiFreeLlmUrl = this.config.APIFREELLM_ENDPOINT || "https://apifreellm.com/api/chat"; 
        this.conversationHistory = [];
        this.gameplayContext = {
            currentGame: 'Jogo não detectado',
            recentEvents: [],
            stats: {}
        };
        this.intensity = this.config.ai?.intensity || 0.5;
        this.isActive = false; // Será ativado em activate()
        this.responseQueue = [];
        this.lastResponseTime = 0;
        this.minResponseInterval = 60000; // 60 segundos entre respostas automáticas

        // O prompt de sistema será carregado do memoryManager
        this.systemPrompt = "Você é um bot de Twitch prestativo e divertido."; // Fallback inicial
        this.personality = {
            style: 'divertido e empático',
            traits: ['criativo', 'encorajador', 'humorístico', 'respeitoso'],
            restrictions: ['sem spam', 'sem conteúdo ofensivo', 'sem spoilers']
        };
    }

    /**
     * Carrega o prompt de sistema do banco de dados via memoryManager.
     */
    async loadSystemPrompt() {
        if (!this.memoryManager) {
            console.warn('MemoryManager não configurado para IA Generativa. Usando prompt padrão.');
            return;
        }
        try {
            const dbPrompt = await this.memoryManager.getConfig('ai_system_prompt');
            if (dbPrompt) {
                this.systemPrompt = dbPrompt;
                console.log('Prompt de sistema da IA carregado do banco de dados.');
            } else {
                console.log('Nenhum prompt de sistema encontrado no banco de dados para IA. Usando prompt padrão.');
            }
        } catch (error) {
            console.error('Erro ao carregar prompt de sistema da IA do banco de dados:', error);
            console.log('Usando prompt de sistema padrão devido ao erro.');
        }
    }

    /**
     * Ativa a IA generativa
     */
    async activate() { // Tornar async para aguardar loadSystemPrompt
        if (this.isActive) {
            console.log('IA Generativa já está ativa');
            return;
        }
        // --- MODIFICAÇÃO: Verifica se o cliente OpenAI foi inicializado ---
        if (!this.openaiClient) {
            console.error('Não foi possível ativar a IA Generativa: Cliente OpenAI não inicializado (API Key ausente ou inválida).');
            return;
        }
        // --- FIM MODIFICAÇÃO ---

        console.log('Ativando IA Generativa...');
        await this.loadSystemPrompt(); // Carrega o prompt ao ativar
        this.isActive = true;

        // Processar fila de respostas a cada 5 segundos
        this.responseProcessor = setInterval(() => {
            this.processResponseQueue();
        }, 5000);

        console.log('IA Generativa ativada com o prompt:');
        console.log(this.systemPrompt); // Log do prompt carregado
    }

    /**
     * Desativa a IA generativa
     */
    deactivate() {
        if (!this.isActive) {
            console.log('IA Generativa já está inativa');
            return;
        }
        console.log('Desativando IA Generativa...');
        this.isActive = false;

        if (this.responseProcessor) {
            clearInterval(this.responseProcessor);
            this.responseProcessor = null;
        }
        console.log('IA Generativa desativada');
    }

    /**
     * Processa mensagens do chat para possível resposta da IA
     */
    async processChatMessage(channel, userstate, message) {
        if (!this.isActive) return;

        // Adicionar mensagem ao histórico
        this.addToConversationHistory(userstate.username, message);

        // Verificar se deve responder
        if (this.shouldRespond(message, userstate)) {
            await this._generateResponseForChat(channel, userstate, message);
        }
    }

    /**
     * Processa eventos de gameplay para contexto
     */
    processGameplayEvent(event) {
        if (!this.isActive) return;
        // Adicionar evento ao contexto
        this.gameplayContext.recentEvents.push({
            ...event,
            timestamp: Date.now()
        });

        // Manter apenas os últimos 10 eventos
        if (this.gameplayContext.recentEvents.length > 10) {
            this.gameplayContext.recentEvents.shift();
        }
        // Salvar evento na memória (se memoryManager estiver configurado)
        if (this.memoryManager) {
            this.memoryManager.saveGameplayEvent(
                event.type,
                event.context,
                event.intensity,
                this.gameplayContext.currentGame
            );
        }

        // Gerar comentário sobre evento importante
        if (event.intensity > 0.7) {
            this.queueGameplayResponse(event);
        }
    }

    /**
     * Atualiza estatísticas de gameplay
     */
    updateGameplayStats(stats) {
        this.gameplayContext.stats = { ...stats };
    }

    /**
     * Atualiza jogo atual
     */
    updateCurrentGame(gameName) {
        this.gameplayContext.currentGame = gameName || 'Jogo não detectado';
    }

    /**
     * Determina se deve responder a uma mensagem de chat
     * (Lógica do cavalo.txt, adaptada para ser mais robusta)
     */
    shouldRespond(message, userstate) {
        // Não responder a comandos
        if (message.startsWith(this.config.bot?.prefix || '!')) return false;

        // Não responder muito frequentemente
        const timeSinceLastResponse = Date.now() - this.lastResponseTime;
        if (timeSinceLastResponse < this.minResponseInterval) return false;

        // Responder se mencionado (nome do bot ou 'ia')
        const botUsername = this.config.twitch.username.toLowerCase();
        const messageLower = message.toLowerCase();
        if (messageLower.includes(botUsername) || messageLower.includes('ia')) {
            return true;
        }
        // Responder baseado na intensidade configurada (chance aleatória)
        const responseChance = this.intensity * 0.1; // 0-10% chance baseado na intensidade
        return Math.random() < responseChance;
    }

    /**
     * Gera resposta para mensagens de chat usando OpenAI
     * (Substitui a chamada para ApiFreeLLM)
     */
    async _generateResponseForChat(channel, userstate, message) {
        if (!this.openaiClient) {
            console.error('Cliente OpenAI não inicializado. Não é possível gerar resposta.');
            return;
        }
        try {
            const context = this._buildContext(userstate, message);
            // --- MODIFICAÇÃO: Constrói o prompt no formato de mensagens da OpenAI ---
            const messages = await this._buildPromptForOpenAI(message, {
                eventType: 'chat_mention', // Ou 'chat_general'
                username: userstate.username,
                game: context.currentGame,
                recentEvents: context.recentEvents,
                stats: context.stats,
                conversationHistory: context.conversationHistory
            });
            // --- FIM MODIFICAÇÃO ---

            // --- MODIFICAÇÃO: Chamada para a API da OpenAI ---
            const chatCompletion = await this.openaiClient.chat.completions.create({
                model: "gpt-3.5-turbo", // Modelo a ser usado. Pode ser configurável.
                messages: messages,
                temperature: 0.7, // Criatividade da resposta (0.0 a 1.0)
                max_tokens: 150 // Limite de tokens na resposta
            });
            const aiResponse = chatCompletion.choices[0].message.content;
            // --- FIM MODIFICAÇÃO ---

            const filteredResponse = this._filterAndCleanResponse(aiResponse);
            if (filteredResponse) {
                this.twitchClient.say(channel, `@${userstate.username} ${filteredResponse}`);
                this.lastResponseTime = Date.now();
                console.log(`IA respondeu no chat: @${userstate.username} ${filteredResponse}`);
                // Salvar interação com resposta na memória (se memoryManager estiver configurado)
                if (this.memoryManager) {
                    this.memoryManager.saveChatInteraction(userstate.username, message, filteredResponse, channel);
                }
            }
        } catch (error) {
            console.error("Erro ao gerar resposta da IA (OpenAI):", error.message);
            if (error.response && error.response.data) {
                console.error('Detalhes do erro da API OpenAI:', error.response.data);
            }
            // Opcional: enviar uma mensagem de erro genérica para o chat
            // this.twitchClient.say(channel, `Desculpe, @${userstate.username}, tive um problema ao gerar a resposta.`);
        }
    }

    /**
     * Adiciona resposta de gameplay à fila
     */
    queueGameplayResponse(event) {
        const response = {
            type: 'gameplay',
            event: event,
            timestamp: Date.now()
        };
        this.responseQueue.push(response);
    }

    /**
     * Processa fila de respostas
     */
    async processResponseQueue() {
        if (this.responseQueue.length === 0) return;

        const response = this.responseQueue.shift();

        // Verificar se não passou muito tempo desde que o evento foi enfileirado
        const timeDiff = Date.now() - response.timestamp;
        if (timeDiff > 60000) { // Ignorar se passou mais de 1 minuto
            console.log('Evento na fila ignorado por tempo limite.');
            return;
        }
        if (response.type === 'gameplay') {
            await this._generateGameplayComment(response.event);
        }
    }

    /**
     * Gera comentário sobre evento de gameplay usando OpenAI
     * (Substitui a chamada para ApiFreeLLM)
     */
    async _generateGameplayComment(event) {
        if (!this.openaiClient) {
            console.error('Cliente OpenAI não inicializado. Não é possível gerar comentário de gameplay.');
            return;
        }
        // Verifica se deve responder com base na intensidade e cooldown
        const eventIntensity = event.intensity || 0.5;
        const threshold = 1 - this.intensity; // Quanto maior a intensidade da IA, menor o threshold para responder
        if (eventIntensity < threshold) {
            return; // Não comenta se o evento não for "intenso" o suficiente para a IA
        }
        // Verifica o intervalo mínimo entre respostas automáticas
        const timeSinceLastResponse = Date.now() - this.lastResponseTime;
        if (timeSinceLastResponse < this.minResponseInterval) {
            return;
        }
        try {
            const promptBase = this._generateGameplayPrompt(event);
            // --- MODIFICAÇÃO: Constrói o prompt no formato de mensagens da OpenAI ---
            const messages = await this._buildPromptForOpenAI(promptBase, {
                eventType: event.type,
                game: this.gameplayContext.currentGame
            });
            // --- FIM MODIFICAÇÃO ---

            // --- MODIFICAÇÃO: Chamada para a API da OpenAI ---
            const chatCompletion = await this.openaiClient.chat.completions.create({
                model: "gpt-3.5-turbo", // Modelo a ser usado.
                messages: messages,
                temperature: 0.8, // Um pouco mais criativo para comentários de gameplay
                max_tokens: 100 // Comentários mais curtos
            });
            const comment = chatCompletion.choices[0].message.content;
            // --- FIM MODIFICAÇÃO ---

            const filteredComment = this._filterAndCleanResponse(comment);
            if (filteredComment) {
                // Enviar para todos os canais configurados
                this.config.twitch.channels.forEach(channel => {
                    this.twitchClient.say(channel, filteredComment);
                });
                this.lastResponseTime = Date.Now(); // Atualiza o tempo da última resposta
                console.log(`IA comentou gameplay: ${filteredComment}`);
            }
        } catch (error) {
            console.error("Erro ao gerar comentário de gameplay (OpenAI):", error.message);
            if (error.response && error.response.data) {
                console.error('Detalhes do erro da API OpenAI:', error.response.data);
            }
        }
    }

    /**
     * Constrói contexto para a IA
     * (Do cavalo.txt)
     */
    _buildContext(userstate, message) {
        return {
            username: userstate.username,
            message: message,
            currentGame: this.gameplayContext.currentGame,
            recentEvents: this.gameplayContext.recentEvents.slice(-3), // Últimos 3 eventos
            stats: this.gameplayContext.stats,
            conversationHistory: this.conversationHistory.slice(-5) // Últimas 5 interações
        };
    }

    /**
     * Constrói o prompt completo para a IA da OpenAI, incluindo personalidade e contexto.
     * O formato da OpenAI é um array de objetos { role: "user/system/assistant", content: "..." }
     * (Adaptado do _buildPrompt do copia.txt, para o formato de mensagens da OpenAI)
     * @param {string} userPrompt - A mensagem original do usuário ou evento.
     * @param {object} context - Contexto adicional (tipo de evento, jogo atual, etc.).
     * @returns {Array<Object>} Um array de objetos de mensagem formatado para a API da OpenAI.
     */
    async _buildPromptForOpenAI(userPrompt, context) { 
        const messages = [];

        // 1. System Prompt (Personalidade do Bot)
        let systemContent = this.systemPrompt; // Seu prompt de sistema carregado do DB

        const gameContext = context.game || this.gameplayContext.currentGame;
        const eventType = context.eventType || 'geral';

        if (gameContext !== 'Jogo não detectado') {
            systemContent += ` O jogo atual é ${gameContext}.`;
        }
        // Adiciona contexto específico de evento, se aplicável
        if (eventType === 'kill') {
            systemContent += ` O jogador acabou de eliminar um inimigo. Comemore essa conquista!`;
        } else if (eventType === 'death') {
            systemContent += ` O jogador foi eliminado. Seja encorajador e positivo.`;
        } else if (eventType === 'win') {
            systemContent += ` O jogador venceu! Comemore essa vitória incrível!`;
        } else if (eventType === 'combo') {
            systemContent += ` O jogador fez um combo espetacular!`;
        } else if (eventType === 'chat_mention' && context.username) {
            systemContent += ` O usuário ${context.username} mencionou você no chat. Responda diretamente a ele.`;
        }

        // --- MODIFICAÇÃO: Injeção da memória de jogos (usando this.gameMemoryService) ---
        if (this.gameMemoryService) { // Garante que a instância existe
            await this.gameMemoryService.updateGameMemory(); 
            const gameMemoryContext = await this.gameMemoryService.getFormattedMemoryForPrompt();
            systemContent += `\n\n${gameMemoryContext}`;
        } else {
            console.warn('GameMemoryService não está disponível na IA Generativa. Contexto de jogos não será adicionado.');
        }
        // --- FIM MODIFICAÇÃO ---

        messages.push({ role: "system", content: systemContent });

        // 2. Histórico de Conversa (como mensagens de 'user' e 'assistant' se aplicável)
        // A OpenAI recomenda um histórico mais conciso para manter o contexto.
        // Aqui, estamos adicionando as últimas interações como mensagens de 'user'.
        // Se você tiver respostas do bot salvas, pode adicioná-las como 'assistant'.
        if (context.conversationHistory && context.conversationHistory.length > 0) {
            context.conversationHistory.forEach(entry => {
                messages.push({ role: "user", content: `${entry.username}: ${entry.message}` });
                // Exemplo se você tivesse respostas do bot no histórico:
                // if (entry.botResponse) {
                //     messages.push({ role: "assistant", content: entry.botResponse });
                // }
            });
        }

        // 3. Mensagem/Evento Atual do Usuário
        messages.push({ role: "user", content: userPrompt });

        return messages;
    }

    /**
     * Gera um prompt específico para eventos de gameplay.
     * (Do copia.txt)
     * @param {object} eventData - Dados do evento de gameplay.
     * @returns {string} Um prompt aleatório para o evento.
     */
    _generateGameplayPrompt(eventData) {
        const prompts = {
            kill: [
                "Que eliminação incrível!",
                "Jogada perfeita!",
                "Dominando o jogo!",
                "Que precisão!"
            ],
            death: [
                "Não desista, você consegue!",
                "Próxima vez vai dar certo!",
                "Faz parte do jogo!",
                "Volta mais forte!"
            ],
            win: [
                "VITÓRIA ÉPICA!",
                "Que partida incrível!",
                "Dominação total!",
                "Jogou demais!"
            ],
            combo: [
                "Que combo espetacular!",
                "Sequência perfeita!",
                "Habilidade pura!",
                "Impressionante!"
            ]
        };
        const eventPrompts = prompts[eventData.type] || ["Que jogada!"];
        return eventPrompts[Math.floor(Math.random() * eventPrompts.length)];
    }

    // REMOVIDO: _callApiFreeLLM (não é mais necessário)

    /**
     * Filtra e limpa a resposta da IA.
     * (Combina filterResponse do cavalo.txt e cleanResponse do copia.txt)
     */
    _filterAndCleanResponse(response) {
        if (!response) return null;
        let cleanedText = response;

        // 1. Verificar palavras banidas (do cavalo.txt)
        const bannedWords = this.config.filters?.bannedWords || [];
        const lowerResponse = cleanedText.toLowerCase();

        for (const word of bannedWords) {
            if (lowerResponse.includes(word.toLowerCase())) {
                console.log('Resposta filtrada por conter palavra banida');
                return null; // Retorna nulo se contiver palavra banida
            }
        }
        // 2. Remover quebras de linha excessivas (do copia.txt)
        cleanedText = cleanedText.replace(/\n+/g, ' ').trim();
        // 3. Limitar tamanho (do copia.txt, ajustado para ser mais restritivo para chat)
        if (cleanedText.length > 400) {
            cleanedText = cleanedText.substring(0, 397) + '...';
        }
        // 4. Remover caracteres especiais problemáticos (do copia.txt)
        // Mantém letras, números, espaços, pontuação básica e alguns emojis comuns de jogo/reação
        cleanedText = cleanedText.replace(/[^\w\s\u00C0-\u017F!?.,;:()🎮🔥💪👏🎯⚡��]/g, '');

        return cleanedText.trim();
    }

    /**
     * Adiciona mensagem ao histórico de conversa
     * (Do cavalo.txt)
     */
    addToConversationHistory(username, message) {
        this.conversationHistory.push({
            username: username,
            message: message,
            timestamp: Date.now()
        });
        // Manter apenas as últimas 20 mensagens
        if (this.conversationHistory.length > 20) {
            this.conversationHistory.shift();
        }
    }

    /**
     * Atualiza intensidade da IA
     * (Do cavalo.txt)
     */
    updateIntensity(intensity) {
        this.intensity = Math.max(0, Math.min(1, intensity));
        console.log(`Intensidade da IA atualizada para: ${this.intensity}`);
    }

    /**
     * Limpa histórico e contexto
     * (Do cavalo.txt)
     */
    reset() {
        this.conversationHistory = [];
        this.gameplayContext.recentEvents = [];
        this.responseQueue = [];
        console.log('Contexto da IA resetado');
    }

    /**
     * Obtém estatísticas da IA
     * (Do cavalo.txt)
     */
    getStats() {
        return {
            isActive: this.isActive,
            intensity: this.intensity,
            conversationHistoryLength: this.conversationHistory.length,
            recentEventsLength: this.gameplayContext.recentEvents.length,
            queueLength: this.responseQueue.length,
            systemPrompt: this.systemPrompt // Inclui o prompt atual nos stats
        };
    }
}
module.exports = GenerativeAI;