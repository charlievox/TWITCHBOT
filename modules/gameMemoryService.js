// modules/gameMemoryService.js
const fs = require('fs').promises;
const path = require('path');

// Importa as classes de serviço (não as instâncias)
const TwitchApiService = require('./twitchApiService');
const XboxApiService = require('./xboxApiService');

class GameMemoryService {
    constructor(config) {
        this.config = config;
        this.memoryFilePath = path.join(__dirname, '..', config.GAMES_MEMORY_FILE);
        this.memory = {
            twitch: [],
            xbox: [],
            lastUpdated: null
        };
        this.twitchApiService = new TwitchApiService(config); // Instancia o serviço Twitch
        this.xboxApiService = new XboxApiService(config);     // Instancia o serviço Xbox
    }

    async initialize() {
        try {
            await this.loadMemory();
            console.log('Memória de jogos inicializada.');
        } catch (error) {
            console.error('Erro ao inicializar a memória de jogos:', error);
            // Se não conseguir carregar, começa com memória vazia
            this.memory = { twitch: [], xbox: [], lastUpdated: null };
            await this.saveMemory(); // Tenta salvar uma memória vazia
        }
    }

    async loadMemory() {
        try {
            const data = await fs.readFile(this.memoryFilePath, 'utf8');
            this.memory = JSON.parse(data);
            console.log('Memória de jogos carregada de \'' + this.config.GAMES_MEMORY_FILE + '\'.');
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.warn('Arquivo de memória de jogos não encontrado. Criando novo.');
                // Garante que o diretório 'memory' exista
                await fs.mkdir(path.dirname(this.memoryFilePath), { recursive: true });
                this.memory = { twitch: [], xbox: [], lastUpdated: null };
                await this.saveMemory();
            } else {
                console.error('Erro ao carregar memória de jogos:', error);
                throw error; // Propaga o erro para que a inicialização falhe
            }
        }
    }

    async saveMemory() {
        try {
            // Garante que o diretório 'memory' exista antes de salvar
            await fs.mkdir(path.dirname(this.memoryFilePath), { recursive: true });
            await fs.writeFile(this.memoryFilePath, JSON.stringify(this.memory, null, 2), 'utf8');
            console.log('Memória de jogos salva em \'' + this.config.GAMES_MEMORY_FILE + '\'.');
        } catch (error) {
            console.error('Erro ao salvar memória de jogos:', error);
        }
    }

    async updateGameMemory() {
        console.log('[GameMemory] Iniciando atualização da memória de jogos...');
        
        // Atualizar jogos da Twitch
        try {
            // CORREÇÃO AQUI: Chamando o método 'getRecentStreamsAndVideos'
            const twitchGames = await this.twitchApiService.getRecentStreamsAndVideos(); 
            this.memory.twitch = twitchGames.slice(0, this.config.MAX_GAMES_PER_PLATFORM);
            console.log(`[GameMemory] Coletados ${twitchGames.length} jogos da Twitch.`);
        } catch (error) {
            console.error('[GameMemory] Erro ao coletar jogos da Twitch:', error.message);
            this.memory.twitch = []; // Limpa se houver erro
        }

        // Atualizar jogos do Xbox
        try {
            // CORREÇÃO AQUI: Chamando o método 'getRecentGames'
            const xboxGames = await this.xboxApiService.getRecentlyPlayedGames(this.maxGamesPerPlatform * 2);
            this.memory.xbox = xboxGames.slice(0, this.config.MAX_GAMES_PER_PLATFORM);
            console.log(`[GameMemory] Coletados ${xboxGames.length} jogos do Xbox.`);
        } catch (error) {
            console.error('[GameMemory] Erro ao coletar jogos do Xbox:', error.message);
            this.memory.xbox = []; // Limpa se houver erro
        }

        this.memory.lastUpdated = new Date().toISOString();
        await this.saveMemory();
        console.log(`[GameMemory] Memória de jogos atualizada e salva com ${this.memory.twitch.length + this.memory.xbox.length} jogos.`);
    }

    getFormattedMemoryForPrompt() {
        let prompt = "Contexto de jogos recentes:\n";
        if (this.memory.twitch.length > 0) {
            prompt += "Twitch: " + this.memory.twitch.map(g => `${g.nome} (última vez em ${g.data})`).join(', ') + ".\n";
        }
        if (this.memory.xbox.length > 0) {
            prompt += "Xbox: " + this.memory.xbox.map(g => `${g.nome} (última vez em ${g.data})`).join(', ') + ".\n";
        }
        if (this.memory.twitch.length === 0 && this.memory.xbox.length === 0) {
            prompt += "Nenhum jogo recente disponível no momento.\n";
        }
        return prompt;
    }

    close() {
        console.log('Fechando GameMemoryService.');
        // Não há recursos abertos para fechar aqui, mas o método existe para consistência.
    }
}

module.exports = GameMemoryService;