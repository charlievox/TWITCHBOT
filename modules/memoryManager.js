/**
 * Módulo de Gerenciamento de Memória
 * Gerencia a memória do bot usando PostgreSQL para persistir dados importantes
 */

const { Pool } = require('pg'); // Importa o Pool de conexões do pg

class MemoryManager {
    constructor(config) {
        this.config = config;
        this.pool = null; // Agora usamos um pool de conexões para PostgreSQL
        this.isInitialized = false;
    }

    /**
     * Inicializa o banco de dados e cria as tabelas necessárias
     */
    async initialize() {
        try {
            // Adicionado para depuração: verifica o valor da variável de ambiente USE_PG_SSL
            console.log('DEBUG: Valor de process.env.USE_PG_SSL:', process.env.USE_PG_SSL);
            this.pool = new Pool({
                connectionString: process.env.DATABASE_URL, // Pega a URL completa do .env
                ssl: process.env.USE_PG_SSL === 'true' ? { rejectUnauthorized: false } : false
                // A linha acima configura o SSL:
                // - Se USE_PG_SSL for 'true', usa SSL com rejectUnauthorized: false (para Render.com)
                // - Caso contrário (se USE_PG_SSL for 'false' ou não definido), desativa o SSL
            });

            // Testar a conexão
            await this.pool.query('SELECT NOW()');
            console.log('Conectado ao banco de dados PostgreSQL');

            await this.createTables(); // Cria ou verifica as tabelas
            this.isInitialized = true;

        } catch (err) {
            console.error('Erro ao inicializar o gerenciador de memória (PostgreSQL):', err);
            throw err; // Re-lança o erro para que o bot não inicie sem DB
        }
    }
    /**
     * Cria as tabelas necessárias no banco de dados
     */
    async createTables() {
        const tables = [
            // Tabela de interações do chat
            `CREATE TABLE IF NOT EXISTS chat_interactions (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                response TEXT,
                timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                channel VARCHAR(255) NOT NULL
            )`,

            // Tabela de eventos de gameplay
            `CREATE TABLE IF NOT EXISTS gameplay_events (
                id SERIAL PRIMARY KEY,
                event_type VARCHAR(255) NOT NULL,
                context TEXT,
                intensity REAL NOT NULL,
                timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                game_name VARCHAR(255)
            )`,
            // Tabela de clips criados
            `CREATE TABLE IF NOT EXISTS clips (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                url TEXT,
                event_type VARCHAR(255),
                timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                is_manual BOOLEAN DEFAULT FALSE,
                is_simulated BOOLEAN DEFAULT FALSE
            )`,

            // Tabela de estatísticas de gameplay
            `CREATE TABLE IF NOT EXISTS gameplay_stats (
                id SERIAL PRIMARY KEY,
                game_name VARCHAR(255) NOT NULL,
                kills INTEGER DEFAULT 0,
                deaths INTEGER DEFAULT 0,
                wins INTEGER DEFAULT 0,
                combos INTEGER DEFAULT 0,
                session_start TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                session_end TIMESTAMPTZ,
                total_playtime INTEGER DEFAULT 0
            )`,
            // Tabela de preferências dos usuários
            `CREATE TABLE IF NOT EXISTS user_preferences (
                username VARCHAR(255) PRIMARY KEY,
                interaction_count INTEGER DEFAULT 0,
                favorite_topics TEXT,
                last_interaction TIMESTAMPTZ,
                is_vip BOOLEAN DEFAULT FALSE,
                custom_greeting TEXT
            )`,

            // Tabela de momentos críticos
            `CREATE TABLE IF NOT EXISTS critical_moments (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                intensity REAL NOT NULL,
                timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                clip_created BOOLEAN DEFAULT FALSE,
                ai_commented BOOLEAN DEFAULT FALSE
            )`,
            // NOVA TABELA: Tabela para configurações gerais do bot (chave-valor)
            `CREATE TABLE IF NOT EXISTS bot_configurations (
                key VARCHAR(255) PRIMARY KEY,
                value TEXT
            )`
        ];

        for (const tableSQL of tables) {
            await this.pool.query(tableSQL); // Usando pool.query diretamente
        }
        console.log('Tabelas de memória criadas/verificadas com sucesso no PostgreSQL');
    }

    /**
     * Executa uma query no banco de dados (INSERT, UPDATE, DELETE)
     * Retorna o ID da última inserção ou o número de linhas afetadas
     */
    async runQuery(sql, params = []) {
        const res = await this.pool.query(sql, params);
        // Para INSERT, RETURNING id pode ser usado para obter o lastID
        // Para UPDATE/DELETE, res.rowCount é o número de linhas afetadas
        return { id: res.rows && res.rows.length > 0 ? res.rows[0].id : null, changes: res.rowCount };
    }

    /**
     * Executa uma query de seleção no banco de dados (retorna uma única linha)
     */
    async getQuery(sql, params = []) {
        const res = await this.pool.query(sql, params);
        return res.rows[0]; // Retorna a primeira linha
    }
    /**
     * Executa uma query que retorna múltiplas linhas
     */
    async allQuery(sql, params = []) {
        const res = await this.pool.query(sql, params);
        return res.rows; // Retorna todas as linhas
    }

    /**
     * Salva uma interação do chat
     */
    async saveChatInteraction(username, message, response, channel) {
        if (!this.isInitialized) return;

        try {
            await this.runQuery(
                'INSERT INTO chat_interactions (username, message, response, timestamp, channel) VALUES ($1, $2, $3, $4, $5)',
                [username, message, response, new Date(), channel]
            );

            // Atualizar preferências do usuário
            await this.updateUserPreferences(username);
        } catch (error) {
            console.error('Erro ao salvar interação do chat:', error);
        }
    }
    /**
     * Salva um evento de gameplay
     */
    async saveGameplayEvent(eventType, context, intensity, gameName) {
        if (!this.isInitialized) return;

        try {
            await this.runQuery(
                'INSERT INTO gameplay_events (event_type, context, intensity, timestamp, game_name) VALUES ($1, $2, $3, $4, $5)',
                [eventType, context, intensity, new Date(), gameName]
            );
        } catch (error) {
            console.error('Erro ao salvar evento de gameplay:', error);
        }
    }

    /**
     * Salva um clip criado
     */
    async saveClip(title, url, eventType, isManual = false, isSimulated = false) {
        if (!this.isInitialized) return null; // Retorna null se não inicializado
        try {
            const result = await this.runQuery(
                'INSERT INTO clips (title, url, event_type, timestamp, is_manual, is_simulated) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                [title, url, eventType, new Date(), isManual, isSimulated]
            );
            return result.id;
        } catch (error) {
            console.error('Erro ao salvar clip:', error);
            return null;
        }
    }

    /**
     * Atualiza estatísticas de gameplay
     */
    async updateGameplayStats(gameName, stats) {
        if (!this.isInitialized) return;

        try {
            // Verificar se já existe uma sessão ativa para este jogo
            const existingSession = await this.getQuery(
                'SELECT * FROM gameplay_stats WHERE game_name = $1 AND session_end IS NULL ORDER BY session_start DESC LIMIT 1',
                [gameName]
            );
            if (existingSession) {
                // Atualizar sessão existente
                await this.runQuery(
                    'UPDATE gameplay_stats SET kills = $1, deaths = $2, wins = $3, combos = $4 WHERE id = $5',
                    [stats.kills || 0, stats.deaths || 0, stats.wins || 0, stats.combos || 0, existingSession.id]
                );
            } else {
                // Criar nova sessão
                await this.runQuery(
                    'INSERT INTO gameplay_stats (game_name, kills, deaths, wins, combos, session_start) VALUES ($1, $2, $3, $4, $5, $6)',
                    [gameName, stats.kills || 0, stats.deaths || 0, stats.wins || 0, stats.combos || 0, new Date()]
                );
            }
        } catch (error) {
            console.error('Erro ao atualizar estatísticas de gameplay:', error);
        }
    }
    /**
     * Atualiza preferências do usuário
     */
    async updateUserPreferences(username) {
        if (!this.isInitialized) return;

        try {
            const existing = await this.getQuery(
                'SELECT * FROM user_preferences WHERE username = $1',
                [username]
            );

            if (existing) {
                await this.runQuery(
                    'UPDATE user_preferences SET interaction_count = interaction_count + 1, last_interaction = $1 WHERE username = $2',
                    [new Date(), username]
                );
            } else {
                await this.runQuery(
                    'INSERT INTO user_preferences (username, interaction_count, last_interaction) VALUES ($1, 1, $2)',
                    [username, new Date()]
                );
            }
        } catch (error) {
            console.error('Erro ao atualizar preferências do usuário:', error);
        }
    }
    /**
     * Salva um momento crítico
     */
    async saveCriticalMoment(title, description, intensity, clipCreated = false, aiCommented = false) {
        if (!this.isInitialized) return null; // Retorna null se não inicializado

        try {
            const result = await this.runQuery(
                'INSERT INTO critical_moments (title, description, intensity, timestamp, clip_created, ai_commented) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                [title, description, intensity, new Date(), clipCreated, aiCommented]
            );
            return result.id;
        } catch (error) {
            console.error('Erro ao salvar momento crítico:', error);
            return null;
        }
    }

    /**
     * Obtém histórico de interações de um usuário
     */
    async getUserHistory(username, limit = 10) {
        if (!this.isInitialized) return [];
        try {
            return await this.allQuery(
                'SELECT * FROM chat_interactions WHERE username = $1 ORDER BY timestamp DESC LIMIT $2',
                [username, limit]
            );
        } catch (error) {
            console.error('Erro ao obter histórico do usuário:', error);
            return [];
        }
    }

    /**
     * Obtém estatísticas recentes de gameplay
     */
    async getRecentGameplayStats(gameName, hours = 24) {
        if (!this.isInitialized) return null;
        try {
            const since = new Date(Date.now() - (hours * 60 * 60 * 1000));
            return await this.getQuery(
                'SELECT SUM(kills) as total_kills, SUM(deaths) as total_deaths, SUM(wins) as total_wins, SUM(combos) as total_combos FROM gameplay_stats WHERE game_name = $1 AND session_start > $2',
                [gameName, since]
            );
        } catch (error) {
            console.error('Erro ao obter estatísticas de gameplay:', error);
            return null;
        }
    }

    /**
     * Obtém clips recentes
     */
    async getRecentClips(limit = 10) {
        if (!this.isInitialized) return [];

        try {
            return await this.allQuery(
                'SELECT * FROM clips ORDER BY timestamp DESC LIMIT $1',
                [limit]
            );
        } catch (error) {
            console.error('Erro ao obter clips recentes:', error);
            return [];
        }
    }
    /**
     * Obtém momentos críticos recentes
     */
    async getRecentCriticalMoments(limit = 10) {
        if (!this.isInitialized) return [];

        try {
            return await this.allQuery(
                'SELECT * FROM critical_moments ORDER BY timestamp DESC LIMIT $1',
                [limit]
            );
        } catch (error) {
            console.error('Erro ao obter momentos críticos:', error);
            return [];
        }
    }

    /**
     * Obtém usuários mais ativos
     */
    async getTopUsers(limit = 10) {
        if (!this.isInitialized) return [];

        try {
            return await this.allQuery(
                'SELECT username, interaction_count, last_interaction FROM user_preferences ORDER BY interaction_count DESC LIMIT $1',
                [limit]
            );
        } catch (error) {
            console.error('Erro ao obter usuários mais ativos:', error);
            return [];
        }
    }
    /**
     * Limpa dados antigos (manutenção)
     */
    async cleanOldData(daysToKeep = 30) {
        if (!this.isInitialized) return;

        try {
            const cutoff = new Date(Date.now() - (daysToKeep * 24 * 60 * 60 * 1000));

            await this.runQuery('DELETE FROM chat_interactions WHERE timestamp < $1', [cutoff]);
            await this.runQuery('DELETE FROM gameplay_events WHERE timestamp < $1', [cutoff]);
            await this.runQuery('DELETE FROM critical_moments WHERE timestamp < $1', [cutoff]);
            await this.runQuery('DELETE FROM clips WHERE timestamp < $1', [cutoff]); // Adicionado para limpar clips também
            await this.runQuery('DELETE FROM gameplay_stats WHERE session_end IS NOT NULL AND session_end < $1', [cutoff]); // Limpa sessões finalizadas
            console.log(`Dados antigos (>${daysToKeep} dias) removidos da memória`);
        } catch (error) {
            console.error('Erro ao limpar dados antigos:', error);
        }
    }

    /**
     * Fecha a conexão com o banco de dados
     */
    async close() { // Tornando assíncrono para usar await this.pool.end()
        if (this.pool) {
            try {
                await this.pool.end();
                console.log('Conexão com banco de dados PostgreSQL fechada');
            } catch (err) {
                console.error('Erro ao fechar banco de dados PostgreSQL:', err);
            }
        }
    }

    /**
     * Salva uma configuração chave-valor no banco de dados
     */
    async saveConfig(key, value) {
        if (!this.isInitialized) return;

        try {
            await this.runQuery(
                'INSERT INTO bot_configurations (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
                [key, value]
            );
            console.log(`Configuração '${key}' salva/atualizada com sucesso.`);
        } catch (error) {
            console.error(`Erro ao salvar configuração '${key}':`, error);
        }
    }

    /**
     * Obtém uma configuração pelo nome da chave
     */
    async getConfig(key) {
        if (!this.isInitialized) return null;

        try {
            const result = await this.getQuery(
                'SELECT value FROM bot_configurations WHERE key = $1',
                [key]
            );
            return result ? result.value : null;
        } catch (error) {
            console.error(`Erro ao obter configuração '${key}':`, error);
            return null;
        }
    }

    /**
     * Obtém estatísticas gerais da memória
     */
    async getMemoryStats() {
        if (!this.isInitialized) return {};

        try {
            const stats = {}; // Removido o 'try' duplicado aqui

            stats.totalInteractions = (await this.getQuery('SELECT COUNT(*) as count FROM chat_interactions')).count;
            stats.totalEvents = (await this.getQuery('SELECT COUNT(*) as count FROM gameplay_events')).count;
            stats.totalClips = (await this.getQuery('SELECT COUNT(*) as count FROM clips')).count;
            stats.totalUsers = (await this.getQuery('SELECT COUNT(*) as count FROM user_preferences')).count;
            stats.totalMoments = (await this.getQuery('SELECT COUNT(*) as count FROM critical_moments')).count;
            stats.totalGameplaySessions = (await this.getQuery('SELECT COUNT(*) as count FROM gameplay_stats')).count; // Adicionado

            return stats;
        } catch (error) {
            console.error('Erro ao obter estatísticas da memória:', error);
            return {};
        }
    }
}

module.exports = MemoryManager;