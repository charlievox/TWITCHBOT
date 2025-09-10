// modules/xboxApiService.js
const axios = require('axios');

class XboxApiService {
    constructor(config) {
        this.config = config;
        this.apiKey = config.XBOX_API_KEY; // Sua chave de API do .env
        this.gamertag = config.XBOX_GAMERTAG; // Seu gamertag do .env

        this.baseUrl = 'https://xbl.io/api/v2';
        this.xuid = null; // Será obtido na primeira chamada
    }

    async _getXuidFromGamertag(gamertag) {
        try {
            console.log(`[XboxAPI] Buscando XUID para o gamertag: ${gamertag}`);
            const response = await axios.get(`${this.baseUrl}/player/gamertag/${encodeURIComponent(gamertag)}`, {
                headers: {
                    'X-Authorization': this.apiKey,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });
            if (response.data && response.data.xuid) {
                this.xuid = response.data.xuid;
                console.log(`[XboxAPI] XUID para ${gamertag} é: ${this.xuid}`);
                return this.xuid;
            } else {
                throw new Error(`XUID não encontrado para o gamertag ${gamertag}.`);
            }
        } catch (error) {
            console.error(`[XboxAPI] Erro ao obter XUID para ${gamertag}:`, error.response?.data || error.message);
            throw error;
        }
    }

    async getRecentGames() {
        if (!this.apiKey || !this.gamertag) {
            console.warn('[XboxAPI] Chave de API ou Gamertag do Xbox não configurados. Usando dados MOCK.');
            return this._getMockData();
        }

        // Se o XUID ainda não foi obtido, tenta obtê-lo
        if (!this.xuid) {
            try {
                await this._getXuidFromGamertag(this.gamertag);
            } catch (error) {
                console.warn('[XboxAPI] Não foi possível obter XUID. Usando dados MOCK.');
                return this._getMockData();
            }
        }

        try {
            console.log(`[XboxAPI] Tentando obter jogos recentes para o XUID: ${this.xuid} via xbl.io`);
            
            const response = await axios.get(`${this.baseUrl}/player/xuid/${this.xuid}/activity`, {
                headers: {
                    'X-Authorization': this.apiKey,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            });

            const rawActivities = response.data.activityItems || [];
            const gameActivities = rawActivities.filter(item => item.activityItemType === 'GamePlayed');

            const uniqueGames = {};
            gameActivities.forEach(activity => {
                const gameName = activity.titleName;
                const dateOccurred = activity.dateOccurred; // Esta é uma timestamp completa

                if (gameName && dateOccurred && (!uniqueGames[gameName] || new Date(dateOccurred) > new Date(uniqueGames[gameName].data))) {
                    uniqueGames[gameName] = {
                        nome: gameName,
                        plataforma: 'Xbox',
                        data: new Date(dateOccurred).toISOString().split('T')[0]
                    };
                }
            });

            const recentGames = Object.values(uniqueGames);

            console.log(`[XboxAPI] Dados da Xbox API puxados com sucesso via xbl.io. Encontrados ${recentGames.length} jogos.`);
            return recentGames.slice(0, this.config.MAX_GAMES_PER_PLATFORM);

        } catch (error) {
            console.error('[XboxAPI] Erro ao obter jogos recentes da Xbox API (xbl.io):', error.response?.data || error.message);
            if (error.response) {
                console.error('Detalhes do erro da API:', error.response.data);
            }
            console.warn('[XboxAPI] Usando dados MOCK devido ao erro na chamada da API real.');
            return this._getMockData();
        }
    }

    _getMockData() {
        console.warn('[XboxAPI] Usando MOCK de dados para jogos recentes do Xbox. Substitua pela chamada real da API.');
        const mockData = [
            { nome: 'Forza Horizon 5', plataforma: 'Xbox', data: '2025-08-18' },
            { nome: 'Halo Infinite', plataforma: 'Xbox', data: '2025-08-15' },
            { nome: 'Starfield', plataforma: 'Xbox', data: '2025-08-10' },
            { nome: 'Gears 5', plataforma: 'Xbox', data: '2025-08-05' },
            { nome: 'Minecraft', plataforma: 'Xbox', data: '2025-08-01' }
        ];
        return mockData.slice(0, this.config.MAX_GAMES_PER_PLATFORM);
    }
}

module.exports = XboxApiService;