const axios = require('axios');

/**
 * Módulo de IA Generativa
 * Gera respostas em tempo real, naturais e contextuais usando ApiFreeLLM.com
 */
class GenerativeAI {
    constructor(config, twitchClient) {
        this.config = config;
        this.twitchClient = twitchClient;
        
        // Configuração para ApiFreeLLM.com
        // Não é necessária chave API para o acesso gratuito e ilimitado
        this.apiFreeLlmUrl = "https://apifreellm.com/api/chat";
        
        this.conversationHistory = [];
        this.gameplayContext = {
            currentGame: 'Jogo não detectado',
            recentEvents: [],
            stats: {}
        };
        
        this.intensity = this.config.ai?.intensity || 0.5;
        this.isActive = false;
        this.responseQueue = [];
        this.lastResponseTime = 0;
        this.minResponseInterval = 30000; // 30 segundos entre respostas automáticas
        
        this.personality = {
            style: 'divertido e empático',
            traits: ['criativo', 'encorajador', 'humorístico', 'respeitoso'],
            restrictions: ['sem spam', 'sem conteúdo ofensivo', 'sem spoilers']
        };
    }

    /**
     * Ativa a IA generativa
     */
    activate() {
        if (this.isActive) {
            console.log('IA Generativa já está ativa');
            return;
        }
        console.log('Ativando IA Generativa...');
        this.isActive = true;
        // Processar fila de respostas a cada 5 segundos (se necessário, para eventos de gameplay)
        this.responseProcessor = setInterval(() => {
            this.processResponseQueue();
        }, 5000);
        console.log('IA Generativa ativada');
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
     * Atualiza a intensidade da IA (frequência de respostas)
     * @param {number} newIntensity - Valor entre 0 e 1.
     */
    updateIntensity(newIntensity) {
        this.intensity = Math.max(0, Math.min(1, newIntensity));
        console.log(`Intensidade da IA atualizada para: ${this.intensity}`);
    }

    /**
     * Atualiza o contexto de gameplay da IA.
     * @param {object} gameData - Dados do jogo, como nome do jogo, eventos recentes, etc.
     */
    updateGameplayContext(gameData) {
        this.gameplayContext.currentGame = gameData.game || 'Jogo não detectado';
        this.gameplayContext.stats = { ...this.gameplayContext.stats, ...gameData.stats };
        
        if (gameData.event) {
            this.gameplayContext.recentEvents.push({
                type: gameData.event.type,
                timestamp: Date.now(),
                intensity: gameData.event.intensity || 0.5
            });
            
            // Manter apenas os últimos 10 eventos
            if (this.gameplayContext.recentEvents.length > 10) {
                this.gameplayContext.recentEvents.shift();
            }
        }
    }

    /**
     * Gera uma resposta usando a API da ApiFreeLLM.com.
     * @param {string} userPrompt - A mensagem ou evento que a IA deve responder.
     * @param {object} context - Contexto adicional para a construção do prompt.
     * @returns {Promise<string|null>} A resposta gerada pela IA ou null em caso de erro.
     */
    async generateResponse(userPrompt, context = {}) {
        if (!this.isActive) {
            console.log('IA inativa, não gerando resposta.');
            return null;
        }
        
        try {
            // Constrói o prompt completo, incluindo a personalidade e o contexto
            const fullPrompt = this.buildPrompt(userPrompt, context);
            
            const payload = {
                message: fullPrompt // ApiFreeLLM.com espera um campo 'message'
            };

            const headers = {
                'Content-Type': 'application/json'
            };

            const response = await axios.post(this.apiFreeLlmUrl, payload, { headers, timeout: 15000 }); // Aumentado timeout para 15s
            
            if (response.data && response.data.response) { // ApiFreeLLM.com retorna no campo 'response'
                let generatedText = response.data.response.trim();
                
                // Limpar e formatar a resposta
                generatedText = this.cleanResponse(generatedText);
                
                // Adicionar à história da conversa (para contexto interno, não para a API)
                this.conversationHistory.push({
                    prompt: userPrompt,
                    response: generatedText,
                    timestamp: Date.now()
                });
                
                // Manter apenas as últimas 5 interações
                if (this.conversationHistory.length > 5) {
                    this.conversationHistory.shift();
                }
                
                return generatedText;
            }
            
            return null;
        } catch (error) {
            console.error('Erro ao gerar resposta da IA (ApiFreeLLM):', error.response?.status || error.message);
            // Se houver um corpo de erro na resposta, imprima-o
            if (error.response && error.response.data) {
                console.error('Detalhes do erro:', error.response.data);
            }
            return null;
        }
    }

    /**
     * Constrói o prompt completo para a IA, incluindo a personalidade e o contexto.
     * @param {string} userPrompt - A mensagem original do usuário ou evento.
     * @param {object} context - Contexto adicional (tipo de evento, jogo atual, etc.).
     * @returns {string} O prompt formatado para ser enviado à IA.
     */
    buildPrompt(userPrompt, context) {
        const gameContext = context.game || this.gameplayContext.currentGame;
        const eventType = context.eventType || 'geral';
        
        let systemPrompt = `Você é um bot de Twitch com personalidade ${this.personality.style}. `;
        systemPrompt += `Suas características: ${this.personality.traits.join(', ')}. `;
        systemPrompt += `Restrições: ${this.personality.restrictions.join(', ')}. `;
        systemPrompt += `Mantenha respostas curtas (máximo 2 frases), seja natural e engajado com a comunidade. `;
        systemPrompt += `Use português brasileiro e seja apropriado para todas as idades. `;
        
        if (gameContext !== 'Jogo não detectado') {
            systemPrompt += `O jogo atual é ${gameContext}. `;
        }

        // Adiciona contexto específico de evento, se aplicável
        if (eventType === 'kill') {
            systemPrompt += `O jogador acabou de eliminar um inimigo. Comemore essa conquista! `;
        } else if (eventType === 'death') {
            systemPrompt += `O jogador foi eliminado. Seja encorajador e positivo. `;
        } else if (eventType === 'win') {
            systemPrompt += `O jogador venceu! Comemore essa vitória incrível! `;
        } else if (eventType === 'combo') {
            systemPrompt += `O jogador fez um combo espetacular! `;
        } else if (eventType === 'chat_mention' && context.username) {
            systemPrompt += `O usuário ${context.username} mencionou você no chat. Responda diretamente a ele. `;
        }

        // Adiciona histórico de conversa para manter algum contexto (se a API suportar, o que a ApiFreeLLM faz implicitamente com o prompt)
        const history = this.conversationHistory
            .map(entry => `Usuário: ${entry.prompt}\nVocê: ${entry.response}`)
            .join('\n');
        
        let finalPrompt = systemPrompt;
        if (history) {
            finalPrompt += `\n\nHistórico recente:\n${history}\n\n`;
        }
        finalPrompt += `Mensagem/Evento: "${userPrompt}"\n\nSua resposta:`;

        return finalPrompt;
    }

    /**
     * Filtra e limpa a resposta da IA.
     * @param {string} text - O texto gerado pela IA.
     * @returns {string} O texto limpo e formatado.
     */
    cleanResponse(text) {
        // Remover quebras de linha excessivas
        text = text.replace(/\n+/g, ' ').trim();
        
        // Limitar tamanho para evitar mensagens muito longas no chat
        if (text.length > 400) { // Reduzido para um tamanho mais adequado para chat
            text = text.substring(0, 397) + '...';
        }
        
        // Remover caracteres especiais problemáticos que não sejam emojis ou pontuação comum
        // Mantém letras, números, espaços, pontuação básica e alguns emojis comuns de jogo/reação
        text = text.replace(/[^\w\s\u00C0-\u017F!?.,;:()🎮🔥💪👏🎯⚡🏆]/g, '');
        
        return text.trim();
    }

    /**
     * Determina se a IA deve responder a um evento ou mensagem.
     * @param {object} eventData - Dados do evento (pode ser uma mensagem de chat ou evento de gameplay).
     * @returns {boolean} True se a IA deve responder, false caso contrário.
     */
    shouldRespond(eventData) {
        if (!this.isActive) return false;
        
        const now = Date.now();
        const timeSinceLastResponse = now - this.lastResponseTime;
        
        // Respeitar intervalo mínimo entre respostas automáticas
        if (timeSinceLastResponse < this.minResponseInterval) {
            return false;
        }
        
        // Verificar intensidade do evento (para eventos de gameplay)
        const eventIntensity = eventData.intensity || 0.5;
        const threshold = 1 - this.intensity; // Quanto maior a intensidade da IA, menor o threshold para responder
        
        // Se for um evento de chat e o bot for mencionado, sempre responder (se ativo)
        if (eventData.type === 'chat_mention') {
            return true;
        }

        // Para outros eventos, usa a lógica de intensidade
        return eventIntensity >= threshold;
    }

    /**
     * Adiciona uma resposta de gameplay à fila para processamento.
     * @param {object} event - O evento de gameplay.
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
     * Processa a fila de respostas pendentes.
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
            await this.generateGameplayComment(response.event);
        }
    }

    /**
     * Gera um comentário sobre um evento de gameplay e o envia para o chat.
     * @param {object} event - O evento de gameplay.
     */
    async generateGameplayComment(event) {
        // Verifica se deve responder com base na intensidade e cooldown
        if (!this.shouldRespond({ type: 'gameplay', intensity: event.intensity })) {
            return;
        }

        const prompt = this.generateGameplayPrompt(event);
        const context = {
            eventType: event.type,
            game: this.gameplayContext.currentGame
        };
        
        const response = await this.generateResponse(prompt, context);
        
        if (response && this.twitchClient) {
            try {
                // Enviar para todos os canais configurados
                this.config.twitch.channels.forEach(channel => {
                    this.twitchClient.say(channel, response);
                });
                this.lastResponseTime = Date.now(); // Atualiza o tempo da última resposta
                console.log(`IA comentou gameplay: ${response}`);
            } catch (error) {
                console.error('Erro ao enviar comentário da IA para o chat:', error);
            }
        }
    }

    /**
     * Gera um prompt específico para eventos de gameplay.
     * @param {object} eventData - Dados do evento de gameplay.
     * @returns {string} Um prompt aleatório para o evento.
     */
    generateGameplayPrompt(eventData) {
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

    /**
     * Processa mensagens do chat para possíveis respostas da IA.
     * @param {string} username - Nome de usuário que enviou a mensagem.
     * @param {string} message - O conteúdo da mensagem.
     * @param {object} userstate - Objeto de estado do usuário (do tmi.js).
     */
    async processChatMessage(username, message, userstate) {
        if (!this.isActive) return;
        
        console.log(`Mensagem do chat processada - ${username}: ${String(message)}`);
        
        // Verifica se o bot deve responder a esta mensagem
        const botUsername = this.config.twitch.username.toLowerCase();
        const messageLower = message.toLowerCase();
        const isMention = messageLower.includes(botUsername) || messageLower.includes('ia'); // Adicionado 'ia' como gatilho
        
        if (isMention || this.shouldRespond({ type: 'chat', intensity: 0.5 })) { // Considera a intensidade para respostas não-mencionadas
            const response = await this.generateResponse(
                message, // A mensagem original do chat
                { eventType: 'chat_mention', username: username } // Contexto para a IA
            );
            
            if (response && this.twitchClient) {
                try {
                    // Responde no canal de onde veio a mensagem
                    const channel = userstate['room-id'] ? `#${userstate['room-id']}` : userstate.channel; // Tenta pegar o canal corretamente
                    this.twitchClient.say(channel, `@${username} ${response}`);
                    this.lastResponseTime = Date.now(); // Atualiza o tempo da última resposta
                    console.log(`IA respondeu no chat: @${username} ${response}`);
                } catch (error) {
                    console.error('Erro ao enviar resposta da IA para o chat:', error);
                }
            }
        }
    }

    /**
     * Processa eventos de gameplay.
     * @param {object} event - O evento de gameplay.
     */
    async processGameplayEvent(event) {
        console.log(`IA processando evento de gameplay: ${event.type} - ${event.description}`);
        // Enfileira o evento para ser processado pela fila de respostas
        this.queueGameplayResponse(event);
    }

    /**
     * Obtém o status atual da IA.
     * @returns {object} Objeto com informações de status.
     */
    getStatus() {
        return {
            active: this.isActive,
            intensity: this.intensity,
            conversationHistory: this.conversationHistory.length,
            recentEvents: this.gameplayContext.recentEvents.length,
            currentGame: this.gameplayContext.currentGame,
            responseQueueLength: this.responseQueue.length
        };
    }

    /**
     * Atualiza estatísticas de gameplay.
     * @param {object} stats - Novas estatísticas de gameplay.
     */
    updateGameplayStats(stats) {
        this.gameplayContext.stats = { ...this.gameplayContext.stats, ...stats };
        console.log('Stats de gameplay atualizadas:', stats);
    }

    /**
     * Atualiza o nome do jogo atual.
     * @param {string} gameName - Nome do jogo.
     */
    updateCurrentGame(gameName) {
        this.gameplayContext.currentGame = gameName || 'Jogo não detectado';
        console.log(`Jogo atual atualizado para: ${this.gameplayContext.currentGame}`);
    }

    /**
     * Limpa o histórico de conversa e o contexto de gameplay.
     */
    reset() {
        this.conversationHistory = [];
        this.gameplayContext.recentEvents = [];
        this.responseQueue = [];
        console.log('Contexto da IA resetado');
    }
}

module.exports = GenerativeAI;