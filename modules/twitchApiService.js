// modules/twitchApiService.js
const axios = require('axios');

class TwitchApiService {
    constructor(config) {
        this.config = config;
        this.clientId = process.env.TWITCH_CLIENT_ID;
        this.clientSecret = process.env.TWITCH_CLIENT_SECRET; // Precisa estar no .env
        this.accessToken = process.env.TWITCH_ACCESS_TOKEN; // Precisa estar no .env
        this.refreshToken = process.env.TWITCH_REFRESH_TOKEN; // Precisa estar no .env
        this.username = process.env.TWITCH_USERNAME; // Precisa estar no .env

        this.twitchApiBaseUrl = 'https://api.twitch.tv/helix';
        this.twitchAuthBaseUrl = 'https://id.twitch.tv/oauth2';

        this.userId = null; // Será buscado na inicialização
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        if (!this.clientId || !this.clientSecret) {
            console.error('[TwitchAPI] TWITCH_CLIENT_ID ou TWITCH_CLIENT_SECRET faltando no .env. Não é possível inicializar a Twitch API.');
            return;
        }

        try {
            // Primeiro, obter um token de acesso de aplicativo se não tivermos um token de acesso de usuário ou se for inválido
            if (!this.accessToken) {
                await this._getAppAccessToken();
            }

            // Em seguida, obter o ID de usuário para o nome de usuário configurado
            await this._getUserId();
            this.initialized = true;
            console.log(`[TwitchAPI] Twitch API inicializada para o usuário: ${this.username} (ID: ${this.userId}).`);
        } catch (error) {
            console.error('[TwitchAPI] Erro ao inicializar Twitch API:', error.message);
            this.initialized = false;
        }
    }

    async _getAppAccessToken() {
        try {
            console.log('[TwitchAPI] Obtendo novo App Access Token...');
            const response = await axios.post(`${this.twitchAuthBaseUrl}/token`, null, {
                params: {
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    grant_type: 'client_credentials'
                }
            });
            this.accessToken = response.data.access_token;
            console.log('[TwitchAPI] App Access Token obtido com sucesso.');
        } catch (error) {
            console.error('[TwitchAPI] Erro ao obter App Access Token:', error.response?.data || error.message);
            throw new Error('Falha ao obter App Access Token da Twitch.');
        }
    }

    async _getUserId() {
        if (!this.accessToken) {
            throw new Error('Access Token não disponível para obter User ID.');
        }
        try {
            console.log(`[TwitchAPI] Obtendo User ID para ${this.username}...`);
            const response = await axios.get(`${this.twitchApiBaseUrl}/users`, {
                headers: {
                    'Client-ID': this.clientId,
                    'Authorization': `Bearer ${this.accessToken}`
                },
                params: {
                    login: this.username
                }
            });
            if (response.data.data && response.data.data.length > 0) {
                this.userId = response.data.data[0].id;
                console.log(`[TwitchAPI] User ID para ${this.username} é: ${this.userId}`);
            } else {
                throw new Error(`Usuário ${this.username} não encontrado.`);
            }
        } catch (error) {
            console.error('[TwitchAPI] Erro ao obter User ID:', error.response?.data || error.message);
            throw new Error('Falha ao obter User ID da Twitch.');
        }
    }

    // Este método é chamado por GameMemoryService
    async getRecentStreamsAndVideos(limit = 5) {
        await this.initialize(); // Garante que a API esteja inicializada

        if (!this.initialized || !this.userId) {
            console.warn('[TwitchAPI] Twitch API não inicializada corretamente (sem ID de usuário). Não é possível obter streams/vídeos.');
            return [];
        }

        let allGames = [];
        try {
            // Obter vídeos recentes (VODs)
            console.log(`[TwitchAPI] Buscando vídeos recentes para o usuário ${this.username} (ID: ${this.userId})...`);
            const videosResponse = await axios.get(`${this.twitchApiBaseUrl}/videos`, {
                headers: {
                    'Client-ID': this.clientId,
                    'Authorization': `Bearer ${this.accessToken}`
                },
                params: {
                    user_id: this.userId,
                    first: limit,
                    type: 'archive' // VODs
                }
            });

            if (videosResponse.data.data) {
                videosResponse.data.data.forEach(video => {
                    if (video.game_name) {
                        allGames.push({
                            nome: video.game_name,
                            plataforma: 'Twitch',
                            data: new Date(video.created_at).toISOString().split('T')[0]
                        });
                    }
                });
            }
            console.log(`[TwitchAPI] Encontrados ${allGames.length} jogos em vídeos recentes.`);

        } catch (error) {
            console.error('[TwitchAPI] Erro ao obter streams/vídeos recentes:', error.response?.data || error.message);
            return [];
        }
        return allGames;
    }
}

module.exports = TwitchApiService;