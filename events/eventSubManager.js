/**
 * Gerenciador de EventSub da Twitch
 * Gerencia inscrições em eventos via Twitch EventSub API
 */

const axios = require('axios');

class EventSubManager {
    constructor(config) {
        this.config = config;
        this.clientId = process.env.TWITCH_CLIENT_ID || '';
        this.accessToken = process.env.TWITCH_ACCESS_TOKEN || '';
        this.webhookUrl = process.env.TWITCH_WEBHOOK_URL || 'https://your-domain.com/webhooks/twitch';
        this.webhookSecret = process.env.TWITCH_WEBHOOK_SECRET || 'your_webhook_secret_here';
        
        this.baseURL = 'https://api.twitch.tv/helix';
        this.subscriptions = [];
    }

    /**
     * Configura headers para requisições à API da Twitch
     */
    getHeaders() {
        return {
            'Client-ID': this.clientId,
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Obtém ID do usuário/canal
     */
    async getUserId(username) {
        try {
            const response = await axios.get(`${this.baseURL}/users`, {
                headers: this.getHeaders(),
                params: { login: username }
            });

            if (response.data.data.length === 0) {
                throw new Error(`Usuário ${username} não encontrado`);
            }

            return response.data.data[0].id;
        } catch (error) {
            console.error(`Erro ao obter ID do usuário ${username}:`, error.message);
            throw error;
        }
    }

    /**
     * Cria inscrição em evento
     */
    async createSubscription(type, condition) {
        try {
            const subscriptionData = {
                type: type,
                version: '1',
                condition: condition,
                transport: {
                    method: 'webhook',
                    callback: this.webhookUrl,
                    secret: this.webhookSecret
                }
            };

            const response = await axios.post(
                `${this.baseURL}/eventsub/subscriptions`,
                subscriptionData,
                { headers: this.getHeaders() }
            );

            console.log(`Inscrição criada para ${type}:`, response.data.data[0].id);
            this.subscriptions.push(response.data.data[0]);
            
            return response.data.data[0];
        } catch (error) {
            console.error(`Erro ao criar inscrição para ${type}:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Configura todas as inscrições necessárias
     */
    async setupSubscriptions() {
        console.log('Configurando inscrições EventSub...');

        if (!this.clientId || !this.accessToken) {
            console.warn('TWITCH_CLIENT_ID ou TWITCH_ACCESS_TOKEN não configurados. Eventos não serão recebidos.');
            return;
        }

        try {
            // Para cada canal configurado
            for (const channel of this.config.twitch.channels) {
                const channelName = channel.replace('#', '');
                const userId = await this.getUserId(channelName);

                // Inscrever em eventos de follow
                await this.createSubscription('channel.follow', {
                    broadcaster_user_id: userId,
                    moderator_user_id: userId
                });

                // Inscrever em eventos de subscribe
                await this.createSubscription('channel.subscribe', {
                    broadcaster_user_id: userId
                });

                // Inscrever em eventos de cheer
                await this.createSubscription('channel.cheer', {
                    broadcaster_user_id: userId
                });

                console.log(`Inscrições configuradas para o canal: ${channelName}`);
            }

            console.log('Todas as inscrições EventSub foram configuradas com sucesso!');
        } catch (error) {
            console.error('Erro ao configurar inscrições:', error);
        }
    }

    /**
     * Lista todas as inscrições ativas
     */
    async listSubscriptions() {
        try {
            const response = await axios.get(`${this.baseURL}/eventsub/subscriptions`, {
                headers: this.getHeaders()
            });

            console.log('Inscrições ativas:', response.data.data);
            return response.data.data;
        } catch (error) {
            console.error('Erro ao listar inscrições:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Remove uma inscrição
     */
    async deleteSubscription(subscriptionId) {
        try {
            await axios.delete(`${this.baseURL}/eventsub/subscriptions`, {
                headers: this.getHeaders(),
                params: { id: subscriptionId }
            });

            console.log(`Inscrição ${subscriptionId} removida`);
        } catch (error) {
            console.error(`Erro ao remover inscrição ${subscriptionId}:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Remove todas as inscrições
     */
    async deleteAllSubscriptions() {
        try {
            const subscriptions = await this.listSubscriptions();
            
            for (const subscription of subscriptions) {
                await this.deleteSubscription(subscription.id);
            }

            console.log('Todas as inscrições foram removidas');
        } catch (error) {
            console.error('Erro ao remover todas as inscrições:', error);
        }
    }
}

module.exports = EventSubManager;

