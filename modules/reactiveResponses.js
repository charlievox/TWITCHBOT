/**
 * Módulo de Respostas Reativas
 * Responde automaticamente a perguntas ou frases específicas no chat
 */

class ReactiveResponses {
    constructor(config, twitchClient, memoryManager = null, generativeAI = null) {
        this.config = config;
        this.twitchClient = twitchClient;
        this.memoryManager = memoryManager;
        this.generativeAI = generativeAI;
        
        this.isActive = false;
        this.responses = new Map();
        this.patterns = [];
        this.lastResponseTime = 0;
        this.minResponseInterval = 5000; // 5 segundos entre respostas reativas
        
        // Respostas padrão
        this.defaultResponses = [
            {
                patterns: ['qual.*setup', 'que.*setup', 'setup.*qual', 'configuração.*pc', 'pc.*configuração'],
                responses: [
                    'Meu setup: PC Gamer com placa de vídeo dedicada, 16GB RAM e SSD! 💻',
                    'Setup básico mas funcional: Ryzen 5, GTX 1660, 16GB RAM! 🎮',
                    'PC intermediário: i5, RTX 3060, 16GB RAM, perfeito para streaming! ⚡'
                ],
                type: 'setup'
            },
            {
                patterns: ['que.*horas.*live', 'horário.*live', 'quando.*stream', 'que.*hora.*stream'],
                responses: [
                    'Geralmente faço live à noite, mas os horários variam! Ativem as notificações! 🔔',
                    'Horários flexíveis, mas sempre aviso no Discord e Twitter! 📱',
                    'Lives normalmente à noite, sigam para não perder! ⭐'
                ],
                type: 'schedule'
            },
            {
                patterns: ['como.*começar', 'dicas.*iniciante', 'sou.*novo', 'começando.*agora'],
                responses: [
                    'Dica de ouro: pratique muito e se divirtam! O importante é jogar! 🎯',
                    'Comecem devagar, assistam tutoriais e não desistam nos primeiros erros! 💪',
                    'Paciência e prática! Todo mundo já foi iniciante um dia! 🌟'
                ],
                type: 'tips'
            },
            {
                patterns: ['qual.*jogo.*favorito', 'jogo.*preferido', 'que.*jogo.*mais.*gosta'],
                responses: [
                    'Difícil escolher! Gosto de FPS, RPG e jogos indie também! 🎮',
                    'Varia muito, mas adoro jogos com boa história e gameplay! 📖',
                    'Cada jogo tem seu charme, mas FPS sempre me empolga! 🔥'
                ],
                type: 'games'
            },
            {
                patterns: ['discord.*link', 'tem.*discord', 'servidor.*discord', 'discord.*servidor'],
                responses: [
                    'Discord na descrição do canal! Venham fazer parte da comunidade! 💬',
                    'Link do Discord está fixado no chat e na bio! 🔗',
                    'Discord ativo com galera incrível, link na descrição! 🎉'
                ],
                type: 'discord'
            },
            {
                patterns: ['como.*melhorar', 'dicas.*melhorar', 'como.*ficar.*melhor', 'treinar.*melhor'],
                responses: [
                    'Treino diário, análise dos próprios erros e muita paciência! 📈',
                    'Assistir pros jogando, treinar aim e estudar estratégias! 🎯',
                    'Consistência é tudo! Treinem um pouco todo dia! ⚡'
                ],
                type: 'improvement'
            }
        ];
        
        this.loadResponses();
    }

    /**
     * Carrega respostas do banco de dados ou usa as padrão
     */
    async loadResponses() {
        if (!this.memoryManager) {
            this.setupDefaultResponses();
            return;
        }

        try {
            const savedResponses = await this.memoryManager.getConfig('reactive_responses');
            if (savedResponses) {
                const parsedResponses = JSON.parse(savedResponses);
                this.setupResponses(parsedResponses);
                console.log(`${parsedResponses.length} respostas reativas carregadas do banco de dados`);
            } else {
                this.setupDefaultResponses();
                await this.saveResponses();
                console.log('Respostas reativas padrão carregadas e salvas no banco de dados');
            }
        } catch (error) {
            console.error('Erro ao carregar respostas reativas:', error);
            this.setupDefaultResponses();
        }
    }

    /**
     * Configura respostas padrão
     */
    setupDefaultResponses() {
        this.setupResponses(this.defaultResponses);
    }

    /**
     * Configura respostas a partir de um array
     */
    setupResponses(responsesArray) {
        this.responses.clear();
        this.patterns = [];

        responsesArray.forEach(responseGroup => {
            const compiledPatterns = responseGroup.patterns.map(pattern => ({
                regex: new RegExp(pattern, 'i'),
                original: pattern
            }));

            this.patterns.push({
                patterns: compiledPatterns,
                responses: responseGroup.responses,
                type: responseGroup.type
            });

            // Mapear cada padrão para o grupo de respostas
            compiledPatterns.forEach(pattern => {
                this.responses.set(pattern.original, {
                    responses: responseGroup.responses,
                    type: responseGroup.type
                });
            });
        });
    }

    /**
     * Salva respostas no banco de dados
     */
    async saveResponses() {
        if (!this.memoryManager) return;

        try {
            const responsesToSave = this.patterns.map(group => ({
                patterns: group.patterns.map(p => p.original),
                responses: group.responses,
                type: group.type
            }));

            await this.memoryManager.saveConfig('reactive_responses', JSON.stringify(responsesToSave));
            console.log('Respostas reativas salvas no banco de dados');
        } catch (error) {
            console.error('Erro ao salvar respostas reativas:', error);
        }
    }

    /**
     * Ativa o sistema de respostas reativas
     */
    activate() {
        if (this.isActive) {
            console.log('Respostas reativas já estão ativas');
            return;
        }

        console.log('Ativando respostas reativas...');
        this.isActive = true;
        console.log(`Respostas reativas ativadas (${this.patterns.length} grupos de padrões)`);
    }

    /**
     * Desativa o sistema de respostas reativas
     */
    deactivate() {
        if (!this.isActive) {
            console.log('Respostas reativas já estão inativas');
            return;
        }

        console.log('Desativando respostas reativas...');
        this.isActive = false;
        console.log('Respostas reativas desativadas');
    }

    /**
     * Processa mensagem do chat para possível resposta reativa
     */
    async processMessage(channel, userstate, message) {
        if (!this.isActive) return;

        // Verificar cooldown
        const now = Date.now();
        if (now - this.lastResponseTime < this.minResponseInterval) {
            return;
        }

        // Não responder a comandos
        if (message.startsWith(this.config.bot?.prefix || '!')) {
            return;
        }

        // Procurar por padrões correspondentes
        const matchedPattern = this.findMatchingPattern(message);
        if (!matchedPattern) return;

        try {
            let responseToSend;

            // Decidir se usar IA ou resposta pré-definida
            const useAI = this.generativeAI && 
                         this.generativeAI.isActive && 
                         this.config.reactiveResponses?.useAI !== false &&
                         Math.random() < 0.4; // 40% chance de usar IA

            if (useAI) {
                responseToSend = await this.generateAIResponse(message, matchedPattern);
            }

            // Se não conseguiu gerar com IA ou não deve usar IA, usar resposta pré-definida
            if (!responseToSend) {
                responseToSend = this.getRandomResponse(matchedPattern.responses);
            }

            if (responseToSend) {
                this.twitchClient.say(channel, `@${userstate.username} ${responseToSend}`);
                this.lastResponseTime = now;
                console.log(`Resposta reativa enviada: @${userstate.username} ${responseToSend}`);

                // Salvar na memória
                if (this.memoryManager) {
                    this.memoryManager.saveChatInteraction(userstate.username, message, responseToSend, channel);
                }
            }

        } catch (error) {
            console.error('Erro ao processar resposta reativa:', error);
        }
    }

    /**
     * Encontra padrão correspondente na mensagem
     */
    findMatchingPattern(message) {
        const messageLower = message.toLowerCase();
        
        for (const patternGroup of this.patterns) {
            for (const pattern of patternGroup.patterns) {
                if (pattern.regex.test(messageLower)) {
                    return {
                        responses: patternGroup.responses,
                        type: patternGroup.type,
                        matchedPattern: pattern.original
                    };
                }
            }
        }
        
        return null;
    }

    /**
     * Gera resposta usando IA
     */
    async generateAIResponse(originalMessage, matchedPattern) {
        if (!this.generativeAI) return null;

        try {
            const contextPrompts = {
                'setup': 'Responda sobre configuração de PC/setup de forma útil e amigável',
                'schedule': 'Responda sobre horários de live de forma acolhedora',
                'tips': 'Dê uma dica útil e motivacional para iniciantes',
                'games': 'Responda sobre preferências de jogos de forma entusiasmada',
                'discord': 'Responda sobre o Discord da comunidade de forma convidativa',
                'improvement': 'Dê conselhos práticos para melhorar no jogo'
            };

            const contextPrompt = contextPrompts[matchedPattern.type] || 'Responda de forma útil e amigável';
            const fullPrompt = `${contextPrompt}. Pergunta: "${originalMessage}"`;

            const aiResponse = await this.generativeAI._callApiFreeLLM(fullPrompt);
            const filteredResponse = this.generativeAI._filterAndCleanResponse(aiResponse);

            if (filteredResponse && filteredResponse.length <= 200) { // Limitar tamanho
                return filteredResponse;
            }

        } catch (error) {
            console.error('Erro ao gerar resposta reativa com IA:', error);
        }

        return null;
    }

    /**
     * Obtém resposta aleatória de um grupo
     */
    getRandomResponse(responses) {
        if (!responses || responses.length === 0) return null;
        return responses[Math.floor(Math.random() * responses.length)];
    }

    /**
     * Adiciona novo padrão de resposta
     */
    async addResponse(patterns, responses, type = 'custom') {
        if (!patterns || !responses || patterns.length === 0 || responses.length === 0) {
            return false;
        }

        const newGroup = {
            patterns: patterns,
            responses: responses,
            type: type
        };

        // Adicionar aos padrões atuais
        const compiledPatterns = patterns.map(pattern => ({
            regex: new RegExp(pattern, 'i'),
            original: pattern
        }));

        this.patterns.push({
            patterns: compiledPatterns,
            responses: responses,
            type: type
        });

        // Mapear padrões
        compiledPatterns.forEach(pattern => {
            this.responses.set(pattern.original, {
                responses: responses,
                type: type
            });
        });

        await this.saveResponses();
        console.log(`Nova resposta reativa adicionada (tipo: ${type})`);
        return true;
    }

    /**
     * Remove padrão de resposta
     */
    async removeResponse(type) {
        const initialLength = this.patterns.length;
        this.patterns = this.patterns.filter(group => group.type !== type);
        
        if (this.patterns.length < initialLength) {
            // Reconfigurar respostas
            const responsesArray = this.patterns.map(group => ({
                patterns: group.patterns.map(p => p.original),
                responses: group.responses,
                type: group.type
            }));
            
            this.setupResponses(responsesArray);
            await this.saveResponses();
            console.log(`Resposta reativa removida (tipo: ${type})`);
            return true;
        }
        
        return false;
    }

    /**
     * Obtém lista de respostas
     */
    getResponses() {
        return this.patterns.map(group => ({
            patterns: group.patterns.map(p => p.original),
            responses: group.responses,
            type: group.type
        }));
    }

    /**
     * Atualiza configurações
     */
    updateConfig(newConfig) {
        if (newConfig.minResponseInterval !== undefined) {
            this.minResponseInterval = Math.max(1000, newConfig.minResponseInterval);
        }

        console.log('Configurações de respostas reativas atualizadas');
    }

    /**
     * Obtém estatísticas
     */
    getStats() {
        return {
            isActive: this.isActive,
            totalPatterns: this.patterns.length,
            totalResponses: this.patterns.reduce((sum, group) => sum + group.responses.length, 0),
            lastResponseTime: this.lastResponseTime,
            minInterval: this.minResponseInterval
        };
    }
}

module.exports = ReactiveResponses;

