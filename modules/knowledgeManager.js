/**
 * Módulo de Gerenciamento de Conhecimento
 * Armazena informações estáticas sobre o streamer para que a IA possa usar
 */

class KnowledgeManager {
    constructor(config, memoryManager = null) {
        this.config = config;
        this.memoryManager = memoryManager;
        
        this.knowledge = new Map();
        this.isInitialized = false;
        
        // Conhecimento padrão
        this.defaultKnowledge = {
            // Informações pessoais
            'streamer_name': 'Streamer',
            'streaming_since': '2024',
            'favorite_games': 'FPS, RPG, Indie Games',
            'streaming_schedule': 'Horários flexíveis, geralmente à noite',
            
            // Setup técnico
            'pc_specs': 'PC Gamer com placa de vídeo dedicada, 16GB RAM, SSD',
            'streaming_software': 'OBS Studio',
            'microphone': 'Microfone USB de qualidade',
            'camera': 'Webcam HD',
            
            // Redes sociais
            'discord_server': 'Link na descrição do canal',
            'twitter': 'Siga nas redes sociais!',
            'youtube': 'Canal no YouTube com highlights',
            
            // Preferências de jogo
            'skill_level': 'Intermediário/Avançado',
            'play_style': 'Agressivo mas estratégico',
            'favorite_weapons': 'Varia por jogo',
            'favorite_maps': 'Mapas clássicos',
            
            // Comunidade
            'community_rules': 'Respeito mútuo, sem spam, sem toxicidade',
            'subscriber_perks': 'Emotes exclusivos e acesso ao Discord VIP',
            'donation_goal': 'Melhorar setup e qualidade das lives',
            
            // Curiosidades
            'fun_facts': 'Amo pizza, café e jogos indie',
            'pet_peeves': 'Campers e cheaters',
            'motto': 'GG sempre, win ou lose!',
            
            // Objetivos
            'streaming_goals': 'Crescer a comunidade e se divertir junto',
            'game_goals': 'Melhorar sempre e fazer jogadas épicas'
        };
    }

    /**
     * Inicializa o gerenciador de conhecimento
     */
    async initialize() {
        if (this.isInitialized) return;

        try {
            await this.loadKnowledge();
            this.isInitialized = true;
            console.log('Gerenciador de Conhecimento inicializado com sucesso');
        } catch (error) {
            console.error('Erro ao inicializar Gerenciador de Conhecimento:', error);
            // Usar conhecimento padrão em caso de erro
            this.setupDefaultKnowledge();
            this.isInitialized = true;
        }
    }

    /**
     * Carrega conhecimento do banco de dados
     */
    async loadKnowledge() {
        if (!this.memoryManager) {
            this.setupDefaultKnowledge();
            return;
        }

        try {
            // Carregar cada item de conhecimento do banco
            const knowledgeKeys = Object.keys(this.defaultKnowledge);
            let loadedCount = 0;

            for (const key of knowledgeKeys) {
                const value = await this.memoryManager.getConfig(`knowledge_${key}`);
                if (value) {
                    this.knowledge.set(key, value);
                    loadedCount++;
                } else {
                    // Usar valor padrão se não existir no banco
                    this.knowledge.set(key, this.defaultKnowledge[key]);
                }
            }

            if (loadedCount === 0) {
                // Se nenhum conhecimento foi carregado, salvar os padrão
                await this.saveAllKnowledge();
                console.log('Conhecimento padrão salvo no banco de dados');
            } else {
                console.log(`${loadedCount} itens de conhecimento carregados do banco de dados`);
            }

        } catch (error) {
            console.error('Erro ao carregar conhecimento:', error);
            this.setupDefaultKnowledge();
        }
    }

    /**
     * Configura conhecimento padrão
     */
    setupDefaultKnowledge() {
        this.knowledge.clear();
        for (const [key, value] of Object.entries(this.defaultKnowledge)) {
            this.knowledge.set(key, value);
        }
        console.log('Conhecimento padrão configurado');
    }

    /**
     * Salva todo o conhecimento no banco de dados
     */
    async saveAllKnowledge() {
        if (!this.memoryManager) return;

        try {
            for (const [key, value] of this.knowledge.entries()) {
                await this.memoryManager.saveConfig(`knowledge_${key}`, value);
            }
            console.log('Todo o conhecimento salvo no banco de dados');
        } catch (error) {
            console.error('Erro ao salvar conhecimento:', error);
        }
    }

    /**
     * Obtém um item de conhecimento
     */
    get(key) {
        return this.knowledge.get(key) || null;
    }

    /**
     * Define um item de conhecimento
     */
    async set(key, value) {
        if (!key || value === undefined) return false;

        this.knowledge.set(key, value);

        // Salvar no banco de dados
        if (this.memoryManager) {
            try {
                await this.memoryManager.saveConfig(`knowledge_${key}`, value);
                console.log(`Conhecimento atualizado: ${key} = ${value}`);
            } catch (error) {
                console.error(`Erro ao salvar conhecimento '${key}':`, error);
            }
        }

        return true;
    }

    /**
     * Remove um item de conhecimento
     */
    async remove(key) {
        if (!this.knowledge.has(key)) return false;

        this.knowledge.delete(key);

        // Remover do banco de dados (definir como null)
        if (this.memoryManager) {
            try {
                await this.memoryManager.saveConfig(`knowledge_${key}`, null);
                console.log(`Conhecimento removido: ${key}`);
            } catch (error) {
                console.error(`Erro ao remover conhecimento '${key}':`, error);
            }
        }

        return true;
    }

    /**
     * Obtém todo o conhecimento
     */
    getAll() {
        const result = {};
        for (const [key, value] of this.knowledge.entries()) {
            result[key] = value;
        }
        return result;
    }

    /**
     * Obtém conhecimento por categoria
     */
    getByCategory(category) {
        const categories = {
            'personal': ['streamer_name', 'streaming_since', 'favorite_games', 'streaming_schedule'],
            'setup': ['pc_specs', 'streaming_software', 'microphone', 'camera'],
            'social': ['discord_server', 'twitter', 'youtube'],
            'gaming': ['skill_level', 'play_style', 'favorite_weapons', 'favorite_maps'],
            'community': ['community_rules', 'subscriber_perks', 'donation_goal'],
            'personal_info': ['fun_facts', 'pet_peeves', 'motto'],
            'goals': ['streaming_goals', 'game_goals']
        };

        const categoryKeys = categories[category] || [];
        const result = {};

        categoryKeys.forEach(key => {
            const value = this.knowledge.get(key);
            if (value) {
                result[key] = value;
            }
        });

        return result;
    }

    /**
     * Busca conhecimento por palavra-chave
     */
    search(keyword) {
        const results = {};
        const keywordLower = keyword.toLowerCase();

        for (const [key, value] of this.knowledge.entries()) {
            if (key.toLowerCase().includes(keywordLower) || 
                value.toLowerCase().includes(keywordLower)) {
                results[key] = value;
            }
        }

        return results;
    }

    /**
     * Gera contexto de conhecimento para a IA
     */
    generateContextForAI(topic = null) {
        let context = '';

        if (topic) {
            // Buscar conhecimento relacionado ao tópico
            const relatedKnowledge = this.search(topic);
            if (Object.keys(relatedKnowledge).length > 0) {
                context += `\nInformações sobre ${topic}:\n`;
                for (const [key, value] of Object.entries(relatedKnowledge)) {
                    context += `- ${key.replace(/_/g, ' ')}: ${value}\n`;
                }
            }
        } else {
            // Gerar contexto geral com informações mais importantes
            const importantKeys = [
                'streamer_name', 'favorite_games', 'streaming_schedule',
                'pc_specs', 'discord_server', 'skill_level', 'play_style', 'motto'
            ];

            context += '\nInformações do streamer:\n';
            importantKeys.forEach(key => {
                const value = this.knowledge.get(key);
                if (value) {
                    context += `- ${key.replace(/_/g, ' ')}: ${value}\n`;
                }
            });
        }

        return context;
    }

    /**
     * Atualiza múltiplos itens de conhecimento
     */
    async updateMultiple(updates) {
        if (!updates || typeof updates !== 'object') return false;

        let updateCount = 0;
        for (const [key, value] of Object.entries(updates)) {
            if (await this.set(key, value)) {
                updateCount++;
            }
        }

        console.log(`${updateCount} itens de conhecimento atualizados`);
        return updateCount > 0;
    }

    /**
     * Exporta conhecimento para JSON
     */
    exportToJSON() {
        return JSON.stringify(this.getAll(), null, 2);
    }

    /**
     * Importa conhecimento de JSON
     */
    async importFromJSON(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            return await this.updateMultiple(data);
        } catch (error) {
            console.error('Erro ao importar conhecimento:', error);
            return false;
        }
    }

    /**
     * Obtém estatísticas do conhecimento
     */
    getStats() {
        const categories = ['personal', 'setup', 'social', 'gaming', 'community', 'personal_info', 'goals'];
        const categoryStats = {};

        categories.forEach(category => {
            const categoryData = this.getByCategory(category);
            categoryStats[category] = Object.keys(categoryData).length;
        });

        return {
            totalItems: this.knowledge.size,
            categories: categoryStats,
            isInitialized: this.isInitialized
        };
    }

    /**
     * Valida se o conhecimento está completo
     */
    validateKnowledge() {
        const requiredKeys = ['streamer_name', 'favorite_games', 'pc_specs', 'streaming_schedule'];
        const missing = [];

        requiredKeys.forEach(key => {
            if (!this.knowledge.has(key) || !this.knowledge.get(key)) {
                missing.push(key);
            }
        });

        return {
            isValid: missing.length === 0,
            missingKeys: missing,
            completeness: ((requiredKeys.length - missing.length) / requiredKeys.length) * 100
        };
    }
}

module.exports = KnowledgeManager;

