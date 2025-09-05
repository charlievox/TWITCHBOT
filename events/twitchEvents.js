/**
 * Módulo de Eventos Twitch
 * Gerencia eventos da Twitch como follow, sub, cheer via EventSub/webhooks
 */

const express = require('express');
const crypto = require('crypto');

class TwitchEvents {
    constructor(config, twitchClient) {
        this.config = config;
        this.twitchClient = twitchClient;
        this.app = express();
        this.server = null;
        this.webhookSecret = process.env.TWITCH_WEBHOOK_SECRET || 'your_webhook_secret_here';
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    /**
     * Configura middleware do Express
     */
    setupMiddleware() {
        this.app.use(express.raw({ type: 'application/json' }));
        
        // Middleware para verificar assinatura do webhook
        this.app.use('/webhooks/twitch', (req, res, next) => {
            const signature = req.headers['twitch-eventsub-message-signature'];
            const timestamp = req.headers['twitch-eventsub-message-timestamp'];
            const body = req.body;

            if (!this.verifySignature(signature, timestamp, body)) {
                return res.status(403).send('Forbidden');
            }

            req.body = JSON.parse(body.toString());
            next();
        });
    }

    /**
     * Configura rotas do webhook
     */
    setupRoutes() {
        // Endpoint principal para webhooks da Twitch
        this.app.post('/webhooks/twitch', (req, res) => {
            const messageType = req.headers['twitch-eventsub-message-type'];
            
            if (messageType === 'webhook_callback_verification') {
                // Verificação inicial do webhook
                console.log('Verificando webhook da Twitch...');
                res.status(200).send(req.body.challenge);
                return;
            }

            if (messageType === 'notification') {
                this.handleEvent(req.body);
            }

            res.status(200).send('OK');
        });

        // Endpoint de saúde
        this.app.get('/health', (req, res) => {
            res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
        });
    }

    /**
     * Verifica a assinatura do webhook da Twitch
     */
    verifySignature(signature, timestamp, body) {
        if (!signature || !timestamp) return false;

        const message = req.headers['twitch-eventsub-message-id'] + timestamp + body;
        const expectedSignature = 'sha256=' + crypto
            .createHmac('sha256', this.webhookSecret)
            .update(message)
            .digest('hex');

        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    }

    /**
     * Processa eventos recebidos da Twitch
     */
    handleEvent(eventData) {
        const eventType = eventData.subscription.type;
        const event = eventData.event;

        console.log(`Evento recebido: ${eventType}`, event);

        switch (eventType) {
            case 'channel.follow':
                this.handleFollowEvent(event);
                break;
            case 'channel.subscribe':
                this.handleSubscribeEvent(event);
                break;
            case 'channel.cheer':
                this.handleCheerEvent(event);
                break;
            default:
                console.log(`Tipo de evento não tratado: ${eventType}`);
        }
    }

    /**
     * Trata evento de follow
     */
    handleFollowEvent(event) {
        const username = event.user_name;
        const message = this.config.bot.messages.follow.replace('{username}', username);
        
        // Enviar mensagem para todos os canais configurados
        this.config.twitch.channels.forEach(channel => {
            this.twitchClient.say(channel, message);
        });

        console.log(`Novo seguidor: ${username}`);
    }

    /**
     * Trata evento de inscrição
     */
    handleSubscribeEvent(event) {
        const username = event.user_name;
        const tier = event.tier;
        const message = this.config.bot.messages.sub.replace('{username}', username);
        
        // Enviar mensagem para todos os canais configurados
        this.config.twitch.channels.forEach(channel => {
            this.twitchClient.say(channel, message);
        });

        console.log(`Nova inscrição: ${username} (Tier ${tier})`);
    }

    /**
     * Trata evento de cheer (bits)
     */
    handleCheerEvent(event) {
        const username = event.user_name;
        const bits = event.bits;
        const message = this.config.bot.messages.cheer
            .replace('{username}', username)
            .replace('{bits}', bits);
        
        // Enviar mensagem para todos os canais configurados
        this.config.twitch.channels.forEach(channel => {
            this.twitchClient.say(channel, message);
        });

        console.log(`Cheer recebido: ${username} - ${bits} bits`);
    }

    /**
     * Inicia o servidor de webhooks
     */
    start(port = 3000) {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(port, '0.0.0.0', (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log(`Servidor de webhooks iniciado na porta ${port}`);
                    resolve();
                }
            });
        });
    }

    /**
     * Para o servidor de webhooks
     */
    stop() {
        if (this.server) {
            this.server.close();
            console.log('Servidor de webhooks parado');
        }
    }

    /**
     * Simula eventos para teste (remover em produção)
     */
    simulateEvents() {
        console.log('Modo de simulação ativado - eventos de teste serão gerados');
        
        // Simular follow a cada 30 segundos
        setInterval(() => {
            this.handleFollowEvent({
                user_name: `TestUser${Math.floor(Math.random() * 1000)}`
            });
        }, 30000);

        // Simular sub a cada 60 segundos
        setInterval(() => {
            this.handleSubscribeEvent({
                user_name: `SubUser${Math.floor(Math.random() * 1000)}`,
                tier: '1000'
            });
        }, 60000);

        // Simular cheer a cada 45 segundos
        setInterval(() => {
            this.handleCheerEvent({
                user_name: `CheerUser${Math.floor(Math.random() * 1000)}`,
                bits: Math.floor(Math.random() * 500) + 100
            });
        }, 45000);
    }
}

module.exports = TwitchEvents;

