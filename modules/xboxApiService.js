// modules/xboxApiService.js
const axios = require('axios');

class XboxApiService {
    constructor(config) {
        this.apiKey = config.XBOX_API_KEY;
        this.gamertag = config.XBOX_GAMERTAG; // O gamertag para o qual a API Key foi gerada
        this.baseUrl = 'https://xbl.io/api/v2';
        // Com base na documentação da OpenXBL, o cabeçalho 'X-Contract: 100'
        // é necessário apenas para 'App Keys' (aplicativos que integram outros usuários).
        // Assumimos que você está usando uma 'API Key' pessoal, então não o incluiremos por padrão.
    }

    /**
     * Obtém o XUID (Xbox User ID) do usuário associado à API Key configurada.
     * Este método usa o endpoint /account que retorna os dados do usuário autenticado.
     */
    async getXuidForAuthenticatedUser() {
        try {
            const headers = {
                'X-Authorization': this.apiKey,
            };

            // Chama o endpoint /account para obter os detalhes do usuário associado à API Key
            const response = await axios.get(`${this.baseUrl}/account`, { headers });

            // A estrutura da resposta pode variar, mas geralmente o XUID está em profileUsers[0].id
            if (response.data && response.data.profileUsers && response.data.profileUsers.length > 0) {
                const xuid = response.data.profileUsers[0].id;
                console.log(`[XboxAPI] XUID encontrado para o gamertag associado à chave: ${xuid}`);
                return xuid;
            }
            // Se a estrutura da resposta for diferente ou o XUID não for encontrado
            throw new Error('XUID não encontrado na resposta da API /account. Verifique a estrutura da resposta.');

        } catch (error) {
            console.error(`[XboxAPI] Erro ao obter XUID via /account (para gamertag ${this.gamertag}):`, error.response?.status || error.message);
            // Re-lança o erro para que o método chamador (getRecentlyPlayedGames) possa lidar com ele
            throw error;
        }
    }

    /**
     * Busca os jogos jogados recentemente pelo usuário Xbox.
     * Primeiro obtém o XUID e depois usa-o para buscar os jogos.
     */
    async getRecentlyPlayedGames(limit) {
        try {
            // Primeiro, obtém o XUID do usuário cuja API Key está sendo usada
            const xuid = await this.getXuidForAuthenticatedUser();

            const headers = {
                'X-Authorization': this.apiKey,
            };

            // Em seguida, obtém os jogos usando o XUID
            // Endpoint: /api/v2/{xuid}/games/played
            const response = await axios.get(`${this.baseUrl}/${xuid}/games/played`, { headers });

            // Processa os dados dos jogos da resposta
            // A documentação implica uma estrutura como: { "games": [ { "title": "Nome do Jogo", "lastPlayed": "Data ISO" } ] }
            if (response.data && response.data.games) {
                const games = response.data.games.map(game => ({
                    nome: game.title,
                    plataforma: 'Xbox',
                    data: game.lastPlayed // Assumindo que é uma string de data ISO
                }));
                console.log(`[XboxAPI] Encontrados ${games.length} jogos recentes do Xbox.`);
                return games.slice(0, limit);
            }
            console.warn('[XboxAPI] Nenhuma informação de jogos encontrada na resposta da API /games/played.');
            return [];

        } catch (error) {
            console.error(`[XboxAPI] Erro ao buscar jogos recentes do Xbox:`, error.response?.status || error.message);
            // Fallback para dados mockados se a busca real falhar
            const mockData = [
                { nome: "Fortnite", plataforma: "Xbox", data: "2024-08-01T10:00:00Z" },
                { nome: "EA SPORTS FC™ 25 Xbox Series X|S", plataforma: "Xbox", data: "2024-07-28T15:30:00Z" },
                { nome: "Delta Force", plataforma: "Xbox", data: "2024-07-25T18:00:00Z" },
                { nome: "EA SPORTS FC™ 25 Xbox One", plataforma: "Xbox", data: "2024-07-20T12:00:00Z" },
                { nome: "Minecraft", plataforma: "Xbox", data: "2024-07-15T09:00:00Z" }
            ];
            console.log('[XboxAPI] Usando MOCK de dados para jogos recentes do Xbox devido ao erro.');
            return mockData.slice(0, limit);
        }
    }
}

module.exports = XboxApiService;