/**
 * Módulo Cliente Twitch
 * Gerencia a conexão e autenticação com a Twitch via tmi.js
 */

const tmi = require('tmi.js');

class TwitchClient {
    constructor(config) {
        this.config = config;
        this.client = null;
        this.isConnected = false;
    }

    /**
     * Inicializa e conecta o cliente Twitch
     */
    async connect() {
        if (!this.config.twitch.username || !this.config.twitch.oauth) {
            throw new Error('Credenciais da Twitch não configuradas no config.json');
        }

        if (this.config.twitch.channels.length === 0) {
            throw new Error('Nenhum canal configurado no config.json');
        }

        const opts = {
            identity: {
                username: this.config.twitch.username,
                password: this.config.twitch.oauth
            },
            channels: this.config.twitch.channels,
            options: {
                debug: false,
                messagesLogLevel: "info"
            },
            connection: {
                reconnect: true,
                secure: true
            }
        };

        this.client = new tmi.client(opts);

        // Event listeners
        this.client.on('message', this.onMessageHandler.bind(this));
        this.client.on('connected', this.onConnectedHandler.bind(this));
        this.client.on('disconnected', this.onDisconnectedHandler.bind(this));

        try {
            await this.client.connect();
            console.log('Bot conectado!');
            this.isConnected = true;
            
            // Enviar mensagem de conexão para todos os canais
            for (const channel of this.config.twitch.channels) {
                this.client.say(channel, this.config.bot.messages.connected);
            }
        } catch (error) {
            console.error('Erro ao conectar:', error);
            throw error;
        }
    }

    /**
     * Handler para mensagens recebidas
     */
    onMessageHandler(target, context, msg, self) {
        if (self) return; // Ignora mensagens do próprio bot

        // Emite evento para outros módulos processarem
        this.emit('message', target, context, msg);
    }

    /**
     * Handler para conexão estabelecida
     */
    onConnectedHandler(addr, port) {
        console.log(`Conectado ao ${addr}:${port}`);
    }

    /**
     * Handler para desconexão
     */
    onDisconnectedHandler(reason) {
        console.log(`Desconectado: ${reason}`);
        this.isConnected = false;
    }

    /**
     * Envia mensagem para um canal
     */
    say(channel, message) {
        if (this.client && this.isConnected) {
            this.client.say(channel, message);
        }
    }

    /**
     * Desconecta o cliente
     */
    disconnect() {
        if (this.client) {
            this.client.disconnect();
            this.isConnected = false;
        }
    }

    /**
     * Sistema de eventos simples
     */
    emit(event, ...args) {
        if (this.listeners && this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(...args));
        }
    }

    on(event, callback) {
        if (!this.listeners) this.listeners = {};
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }
}

module.exports = TwitchClient;

