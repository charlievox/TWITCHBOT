/**
 * Módulo de IA Generativa
 * Gera respostas em tempo real, naturais e contextuais usando Grok
 */

const axios = require("axios");

class GenerativeAI {
    constructor(config, twitchClient) {
        this.config = config;
        this.twitchClient = twitchClient;
        this.apiUrl = "https://api.x.ai/v1/chat/completions";
        this.apiKey = process.env.OPENAI_API_KEY;
        
        if (!this.apiKey) {
            console.warn("ATENÇÃO: Chave da API do Grok (OPENAI_API_KEY) não configurada. A IA generativa pode não funcionar.");
        }
        
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
        
        // Processar fila de respostas a cada 5 segundos
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
     * Processa mensagens do chat para possível resposta da IA
     */
    async processChatMessage(channel, userstate, message) {
        if (!this.isActive) return;

        // Adicionar mensagem ao histórico
        this.addToConversationHistory(userstate.username, message);

        // Verificar se deve responder
        if (this.shouldRespond(message, userstate)) {
            await this.generateResponse(channel, userstate, message);
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
     * Determina se deve responder a uma mensagem
     */
    shouldRespond(message, userstate) {
        // Não responder a comandos
        if (message.startsWith(this.config.bot.prefix)) return false;

        // Não responder muito frequentemente
        const timeSinceLastResponse = Date.now() - this.lastResponseTime;
        if (timeSinceLastResponse < this.minResponseInterval) return false;

        // Responder se mencionado
        if (message.toLowerCase().includes(this.config.twitch.username.toLowerCase())) {
            return true;
        }

        // Responder baseado na intensidade configurada
        const responseChance = this.intensity * 0.1; // 0-10% chance baseado na intensidade
        return Math.random() < responseChance;
    }

    /**
     * Gera resposta usando Grok
     */
    async generateResponse(channel, userstate, message) {
        try {
            const context = this.buildContext(userstate, message);
            const prompt = this.buildPrompt(context);

            const headers = {
                "Authorization": `Bearer ${this.apiKey}`,
                "Content-Type": "application/json"
            };

            const payload = {
                model: "grok-4-latest",
                messages: [
                    {
                        role: "system",
                        content: this.getSystemPrompt()
                    },
                    {
                        role: "user", 
                        content: prompt
                    }
                ],
                max_tokens: 100,
                temperature: 0.8,
                stream: false
            };

            const response = await axios.post(this.apiUrl, payload, { headers });
            const aiResponse = response.data.choices[0].message.content.trim();
            
            // Filtrar resposta
            const filteredResponse = this.filterResponse(aiResponse);
            
            if (filteredResponse) {
                this.twitchClient.say(channel, filteredResponse);
                this.lastResponseTime = Date.now();
                console.log(`IA respondeu: ${filteredResponse}`);
            }

        } catch (error) {
            console.error("Erro ao gerar resposta da IA (Grok):", error.response ? error.response.data : error.message);
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
        
        // Verificar se não passou muito tempo
        const timeDiff = Date.now() - response.timestamp;
        if (timeDiff > 60000) return; // Ignorar se passou mais de 1 minuto

        if (response.type === 'gameplay') {
            await this.generateGameplayComment(response.event);
        }
    }

    /**
     * Gera comentário sobre evento de gameplay
     */
    async generateGameplayComment(event) {
        try {
            const prompt = `Comente brevemente sobre este evento de gameplay: ${event.type} - ${event.context}. Seja entusiasmado e positivo.`;

            const headers = {
                "Authorization": `Bearer ${this.apiKey}`,
                "Content-Type": "application/json"
            };

            const payload = {
                model: "grok-4-latest",
                messages: [
                    {
                        role: "system",
                        content: this.getSystemPrompt()
                    },
                    {
                        role: "user", 
                        content: prompt
                    }
                ],
                max_tokens: 50,
                temperature: 0.9,
                stream: false
            };

            const response = await axios.post(this.apiUrl, payload, { headers });
            const comment = response.data.choices[0].message.content.trim();
            const filteredComment = this.filterResponse(comment);
            
            if (filteredComment) {
                // Enviar para todos os canais
                this.config.twitch.channels.forEach(channel => {
                    this.twitchClient.say(channel, filteredComment);
                });
                
                console.log(`IA comentou gameplay: ${filteredComment}`);
            }

        } catch (error) {
            console.error("Erro ao gerar comentário de gameplay (Grok):", error.response ? error.response.data : error.message);
        }
    }

    /**
     * Constrói contexto para a IA
     */
    buildContext(userstate, message) {
        return {
            username: userstate.username,
            message: message,
            currentGame: this.gameplayContext.currentGame,
            recentEvents: this.gameplayContext.recentEvents.slice(-3),
            stats: this.gameplayContext.stats,
            conversationHistory: this.conversationHistory.slice(-5)
        };
    }

    /**
     * Constrói prompt para a IA
     */
    buildPrompt(context) {
        let prompt = `Usuário ${context.username} disse: "${context.message}"\n`;
        
        if (context.currentGame !== 'Jogo não detectado') {
            prompt += `Jogo atual: ${context.currentGame}\n`;
        }

        if (context.recentEvents.length > 0) {
            prompt += `Eventos recentes: ${context.recentEvents.map(e => e.type).join(', ')}\n`;
        }

        prompt += 'Responda de forma natural, divertida e contextual.';
        
        return prompt;
    }

    /**
     * Obtém prompt do sistema para definir personalidade
     */
    getSystemPrompt() {
        return `Você é um bot de Twitch com personalidade ${this.personality.style}. 
        Suas características: ${this.personality.traits.join(', ')}.
        Restrições: ${this.personality.restrictions.join(', ')}.
        Mantenha respostas curtas (máximo 2 frases), seja natural e engajado com a comunidade.
        Use português brasileiro e seja apropriado para todas as idades.`;
    }

    /**
     * Filtra resposta para remover conteúdo inadequado
     */
    filterResponse(response) {
        // Verificar palavras banidas
        const bannedWords = this.config.filters?.bannedWords || [];
        const lowerResponse = response.toLowerCase();
        
        for (const word of bannedWords) {
            if (lowerResponse.includes(word.toLowerCase())) {
                console.log('Resposta filtrada por conter palavra banida');
                return null;
            }
        }

        // Verificar comprimento
        if (response.length > 500) {
            response = response.substring(0, 497) + '...';
        }

        return response;
    }

    /**
     * Adiciona mensagem ao histórico de conversa
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
     */
    updateIntensity(intensity) {
        this.intensity = Math.max(0, Math.min(1, intensity));
        console.log(`Intensidade da IA atualizada para: ${this.intensity}`);
    }

    /**
     * Limpa histórico e contexto
     */
    reset() {
        this.conversationHistory = [];
        this.gameplayContext.recentEvents = [];
        this.responseQueue = [];
        console.log('Contexto da IA resetado');
    }

    /**
     * Obtém estatísticas da IA
     */
    getStats() {
        return {
            isActive: this.isActive,
            intensity: this.intensity,
            conversationHistoryLength: this.conversationHistory.length,
            recentEventsLength: this.gameplayContext.recentEvents.length,
            queueLength: this.responseQueue.length
        };
    }
}

module.exports = GenerativeAI;