// modules/recurringMessages.js

/**
 * Módulo de Mensagens Recorrentes
 * Envia mensagens pré-definidas para o chat em intervalos regulares,
 * com a capacidade de pausar ou resetar o timer com base na atividade do chat.
 */
class RecurringMessages {
    constructor(config, twitchClient, memoryManager, generativeAI) {
        this.config = config;
        this.twitchClient = twitchClient;
        this.memoryManager = memoryManager; // Pode ser usado para buscar mensagens do DB
        this.generativeAI = generativeAI;   // Pode ser usado para gerar mensagens dinâmicas

        // Configurações padrão para mensagens recorrentes (ajuste conforme necessário)
        // Idealmente, estas configurações viriam do this.config.bot.recurringMessages
        this.messages = [
            "Lembre-se de seguir o canal para não perder nenhuma live!",
            "Para comandos do bot, digite !comandos no chat!",
            "Quer saber mais sobre o bot? Pergunte no chat!",
            "Se você está gostando da live, considere deixar um like e compartilhar!"
        ];
        this.intervalTime = 15 * 60 * 1000; // 15 minutos em milissegundos
        this.minChatActivityInterval = 5 * 60 * 1000; // Mínimo de 5 minutos de inatividade para enviar mensagem
        this.lastChatActivity = Date.now();
        this.messageIndex = 0;
        this.timer = null;
        this.isActive = false;

        // Tenta carregar mensagens e configurações do config.json se existirem
        // (Assumindo que seu config.json pode ter uma seção para recurringMessages)
        if (this.config.bot && this.config.bot.recurringMessages) {
            const rmConfig = this.config.bot.recurringMessages;
            if (Array.isArray(rmConfig.messages) && rmConfig.messages.length > 0) {
                this.messages = rmConfig.messages;
            }
            if (typeof rmConfig.intervalTime === 'number') {
                this.intervalTime = rmConfig.intervalTime * 1000; // Converte para ms
            }
            if (typeof rmConfig.minChatActivityInterval === 'number') {
                this.minChatActivityInterval = rmConfig.minChatActivityInterval * 1000; // Converte para ms
            }
        }
    }

    /**
     * Ativa o sistema de mensagens recorrentes.
     */
    activate() {
        if (this.isActive) {
            console.log('[RecurringMessages] Já ativo.');
            return;
        }
        this.isActive = true;
        console.log('[RecurringMessages] Ativado. Próxima mensagem em breve...');
        this._startTimer();
    }

    /**
     * Desativa o sistema de mensagens recorrentes.
     */
    deactivate() {
        if (!this.isActive) {
            console.log('[RecurringMessages] Já inativo.');
            return;
        }
        this.isActive = false;
        this._stopTimer();
        console.log('[RecurringMessages] Desativado.');
    }

    /**
     * Inicia o timer para enviar a próxima mensagem.
     */
    _startTimer() {
        this._stopTimer(); // Garante que não há timers duplicados
        this.timer = setTimeout(() => this._sendMessage(), this.intervalTime);
    }

    /**
     * Para o timer de mensagens.
     */
    _stopTimer() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    /**
     * Envia uma mensagem recorrente para o chat.
     */
    async _sendMessage() {
        if (!this.isActive) return;

        // Verifica a atividade do chat antes de enviar a mensagem
        const timeSinceLastActivity = Date.now() - this.lastChatActivity;
        if (timeSinceLastActivity < this.minChatActivityInterval) {
            console.log('[RecurringMessages] Atividade recente no chat, adiando mensagem.');
            this._startTimer(); // Reinicia o timer para tentar novamente mais tarde
            return;
        }

        const channel = this.config.twitch.channels[0]; // Assume o primeiro canal configurado
        if (!channel) {
            console.warn('[RecurringMessages] Nenhum canal Twitch configurado para enviar mensagens recorrentes.');
            this._startTimer();
            return;
        }

        let messageToSend = this.messages[this.messageIndex];

        // Opcional: Usar IA para gerar mensagem dinâmica
        // Se você quiser que a IA gere mensagens recorrentes, descomente o bloco abaixo
        // e certifique-se de que this.generativeAI esteja configurado e ativo.
        /*
        if (this.generativeAI && this.generativeAI.isActive) {
            try {
                // Exemplo: pedir para a IA gerar uma mensagem sobre o jogo atual
                // Você precisaria de um método em generativeAI para chamar a API sem ser um chat message
                // Por exemplo: this.generativeAI._callApiFreeLLM(aiPrompt);
                // const aiPrompt = `Gere uma mensagem curta e divertida para o chat sobre o jogo atual: ${this.generativeAI.gameplayContext.currentGame}.`;
                // const aiGeneratedMessage = await this.generativeAI.generateDynamicMessage(aiPrompt); // Supondo um novo método
                // if (aiGeneratedMessage) {
                //     messageToSend = aiGeneratedMessage;
                //     console.log('[RecurringMessages] Mensagem gerada pela IA.');
                // }
            } catch (error) {
                console.error('[RecurringMessages] Erro ao gerar mensagem com IA:', error);
            }
        }
        */

        if (messageToSend) {
            this.twitchClient.say(channel, messageToSend);
            console.log(`[RecurringMessages] Mensagem enviada: "${messageToSend}"`);
            this.messageIndex = (this.messageIndex + 1) % this.messages.length; // Próxima mensagem na lista
        } else {
            console.warn('[RecurringMessages] Nenhuma mensagem para enviar.');
        }

        this._startTimer(); // Reinicia o timer para a próxima mensagem
    }

    /**
     * Chamado quando há atividade no chat (ex: uma nova mensagem).
     * Reseta o timer de inatividade para evitar que mensagens recorrentes
     * sejam enviadas quando o chat já está ativo.
     */
    onChatActivity() {
        this.lastChatActivity = Date.now();
        // Opcional: Se a atividade for muito frequente, você pode querer resetar o timer principal também
        // this._startTimer(); // Descomente se quiser que qualquer atividade de chat resete o timer principal
    }
}

module.exports = RecurringMessages;