// modules/webPanel.js
const express = require('express');
const cors = require('cors');
const path = require('path');
// --- MODIFICAÇÃO: Remove a importação direta de gameMemoryService ---
// A instância de gameMemoryService é acessada via this.bot.gameMemoryService
// const gameMemoryService = require('../modules/gameMemoryService'); 
// --- FIM MODIFICAÇÃO ---

class WebPanel {
    constructor(bot, config) {
        this.bot = bot;
        this.config = config;
        this.app = express();
        this.server = null;
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    /**
     * Configura middleware do Express
     */
    setupMiddleware() {
        // CORS para permitir acesso de qualquer origem
        this.app.use(cors());
        
        // Parse JSON
        this.app.use(express.json());
        
        // Servir arquivos estáticos
        this.app.use(express.static(path.join(__dirname, 'public')));
        
        // Middleware de autenticação para rotas de API que modificam dados
        this.app.use('/api', this.authenticateApiRequests.bind(this));
    }

    /**
     * Middleware para autenticar requisições de API.
     * Verifica a presença de uma chave secreta no cabeçalho 'x-api-key'.
     */
    authenticateApiRequests(req, res, next) {
        // Rotas GET (leitura) não precisam de autenticação para o painel público
        if (req.method === 'GET') {
            return next();
        }

        // Para rotas POST, PUT, DELETE, etc., requer autenticação
        const apiKey = req.headers['x-api-key'];
        // Acessa WEB_PANEL_SECRET do objeto config (carregado do .env)
        const expectedApiKey = this.config.WEB_PANEL_SECRET; 

        if (!expectedApiKey) {
            console.warn('[WEB PANEL] WEB_PANEL_SECRET não configurado. Painel web está desprotegido para operações de escrita.');
            // --- MODIFICAÇÃO: Reforça a segurança em produção ---
            if (process.env.NODE_ENV === 'production') {
                console.error('[WEB PANEL] EM PRODUÇÃO: WEB_PANEL_SECRET é obrigatório para operações de escrita. Acesso negado.');
                return res.status(500).json({ success: false, message: 'Erro de configuração do servidor: Chave de API não configurada.' });
            }
            // Permite em desenvolvimento se a chave não estiver configurada (APENAS PARA DEV!)
            console.warn('[WEB PANEL] Permitindo acesso sem chave em ambiente de desenvolvimento (NODE_ENV != production).');
            return next(); 
        }

        if (!apiKey || apiKey !== expectedApiKey) {
            console.warn('[WEB PANEL] Tentativa de acesso não autorizado com chave inválida ou ausente.');
            return res.status(401).json({ success: false, message: 'Não autorizado: Chave de API inválida ou ausente.' });
        }

        next(); // Autenticado, prossegue para a próxima rota
    }

    /**
     * Configura rotas da API
     */
    setupRoutes() {
        // Página principal
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });
        // NOVA ROTA: Página de configuração da IA
        this.app.get('/ai-config', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'ai-config.html'));
        });

        // API - Status geral do bot (GET - não precisa de autenticação)
        this.app.get('/api/status', (req, res) => {
            res.json(this.getBotStatus());
        });
        
        // API - Configurações (GET - não precisa de autenticação)
        this.app.get('/api/config', (req, res) => {
            // Retorna uma cópia da configuração para evitar modificações acidentais pelo cliente
            // e para não expor a WEB_PANEL_SECRET
            const publicConfig = { ...this.config };
            delete publicConfig.WEB_PANEL_SECRET; // Garante que a chave secreta não seja exposta
            res.json(publicConfig);
        });

        // API - Atualizar Configurações (POST - precisa de autenticação)
        this.app.post('/api/config', (req, res) => {
            console.log('[WEB PANEL] Recebida requisição para atualizar configurações.');
            try {
                this.updateConfig(req.body);
                console.log('[WEB PANEL] Configurações atualizadas com sucesso (em memória).');
                // IMPORTANTE: As alterações em 'this.config' não são persistidas automaticamente.
                // Para que sobrevivam a um reinício do bot, você precisaria de um mecanismo
                // para salvar a configuração atualizada em um arquivo (ex: config.json).
                res.json({ success: true, message: 'Configuração atualizada' });
            } catch (error) {
                console.error('[WEB PANEL ERROR] Erro ao atualizar configurações:', error.message);
                res.status(400).json({ success: false, message: error.message });
            }
        });

        // API - Controle de camadas (POST - precisa de autenticação)
        this.app.post('/api/layers/:layer/toggle', (req, res) => {
            const layer = req.params.layer;
            const enabled = req.body.enabled;
            console.log(`[WEB PANEL] Recebida requisição para ${enabled ? 'ativar' : 'desativar'} camada: ${layer}`);
            try {
                this.toggleLayer(layer, enabled);
                console.log(`[WEB PANEL] Camada ${layer} ${enabled ? 'ativada' : 'desativada'} com sucesso (em memória).`);
                // IMPORTANTE: Similar à atualização de config geral, o estado das camadas
                // (seja via this.config.bot.features ou nos módulos) não é persistido automaticamente.
                res.json({ success: true, message: `Camada ${layer} ${enabled ? 'ativada' : 'desativada'}` });
            } catch (error) {
                console.error(`[WEB PANEL ERROR] Erro ao alternar camada ${layer}:`, error.message);
                res.status(400).json({ success: false, message: error.message });
            }
        });

        // API - Estatísticas de gameplay (GET - não precisa de autenticação)
        this.app.get('/api/gameplay/stats', (req, res) => {
            if (this.bot.streamObserver) {
                res.json(this.bot.streamObserver.getGameplayStats());
            } else {
                res.json({});
            }
        });

        // API - Momentos críticos (GET - não precisa de autenticação)
        this.app.get('/api/gameplay/moments', (req, res) => {
            if (this.bot.streamObserver) {
                res.json(this.bot.streamObserver.getCriticalMoments());
            } else {
                res.json([]);
            }
        });

        // API - Clips recentes (GET - não precisa de autenticação)
        this.app.get('/api/clips', (req, res) => {
            if (this.bot.autoClipper) {
                res.json(this.bot.autoClipper.getRecentClips());
            } else {
                res.json([]);
            }
        });

        // API - Criar clip manual (POST - precisa de autenticação)
        this.app.post('/api/clips/manual', async (req, res) => {
            const title = req.body.title || 'Clip Manual';
            console.log(`[WEB PANEL] Recebida requisição para criar clip manual: "${title}"`);
            try {
                if (this.bot.autoClipper) {
                    await this.bot.autoClipper.createManualClip(title); 
                    console.log(`[WEB PANEL] Clip manual "${title}" criado com sucesso.`);
                    res.json({ success: true, message: 'Clip manual criado' });
                } else {
                    console.warn('[WEB PANEL] Tentativa de criar clip manual, mas Auto Clipper não está ativo.');
                    res.status(400).json({ success: false, message: 'Auto Clipper não está ativo' });
                }
            } catch (error) {
                console.error(`[WEB PANEL ERROR] Erro ao criar clip manual "${title}":`, error.message);
                res.status(400).json({ success: false, message: error.message });
            }
        });

        // API - Estatísticas da IA (GET - não precisa de autenticação)
        this.app.get('/api/ai/stats', (req, res) => {
            if (this.bot.generativeAI) {
                res.json(this.bot.generativeAI.getStats());
            } else {
                res.json({ isActive: false });
            }
        });

        // API - Obter Prompt da IA (GET - não precisa de autenticação)
        this.app.get('/api/ai/prompt', async (req, res) => {
            if (this.bot.generativeAI && this.bot.generativeAI.memoryManager) {
                try {
                    // Assume que memoryManager.getConfig pode ler a configuração do prompt
                    const prompt = await this.bot.generativeAI.memoryManager.getConfig('ai_system_prompt');
                    res.json({ prompt: prompt || '' });
                } catch (error) {
                    console.error('[WEB PANEL ERROR] Erro ao buscar prompt da IA:', error);
                    res.status(500).json({ success: false, error: 'Erro interno ao buscar prompt.' });
                }
            } else {
                res.status(400).json({ success: false, message: 'IA Generativa ou MemoryManager não estão ativos.' });
            }
        });

        // API - Atualizar Prompt da IA (POST - precisa de autenticação)
        this.app.post('/api/ai/prompt', async (req, res) => {
            const prompt = req.body.prompt;
            console.log('[WEB PANEL] Recebida requisição para atualizar prompt da IA.');
            try {
                if (this.bot.generativeAI && this.bot.generativeAI.memoryManager) {
                    // Assume que memoryManager.saveConfig pode persistir a configuração do prompt
                    await this.bot.generativeAI.memoryManager.saveConfig('ai_system_prompt', prompt);    
                    console.log('[WEB PANEL] Prompt da IA atualizado com sucesso!');
                    // IMPORTANTE: A persistência do prompt depende do MemoryManager.
                    // Se o MemoryManager não salvar em DB/arquivo, a mudança será apenas em memória.
                    res.json({ success: true, message: 'Prompt da IA atualizado com sucesso!' });
                } else {
                    console.warn('[WEB PANEL] Tentativa de atualizar prompt da IA, mas IA Generativa ou MemoryManager não estão ativos.');
                    res.status(400).json({ success: false, message: 'IA Generativa ou MemoryManager não estão ativos.' });
                }
            } catch (error) {
                console.error('[WEB PANEL ERROR] Erro ao atualizar prompt da IA:', error);
                res.status(500).json({ success: false, error: 'Erro interno ao atualizar prompt.' });
            }
        });

        // API - Atualizar intensidade da IA (POST - precisa de autenticação)
        this.app.post('/api/ai/intensity', (req, res) => {
            const intensity = parseFloat(req.body.intensity);
            console.log(`[WEB PANEL] Recebida requisição para atualizar intensidade da IA para: ${intensity}`);
            try {
                if (this.bot.generativeAI) {
                    this.bot.generativeAI.updateIntensity(intensity);
                    console.log(`[WEB PANEL] Intensidade da IA atualizada para ${intensity} com sucesso (em memória).`);
                    // IMPORTANTE: A intensidade da IA é atualizada em memória.
                    // Para persistir, a configuração 'ai.intensity' precisaria ser salva em um arquivo.
                    res.json({ success: true, message: `Intensidade da IA atualizada para ${intensity}` });
                } else {
                    console.warn('[WEB PANEL] Tentativa de atualizar intensidade da IA, mas IA Generativa não está ativa.');
                    res.status(400).json({ success: false, message: 'IA Generativa não está ativa' });
                }
            } catch (error) {
                console.error(`[WEB PANEL ERROR] Erro ao atualizar intensidade da IA para ${intensity}:`, error.message);
                res.status(400).json({ success: false, message: error.message });
            }
        });

        // API - Atualizar sensibilidade do observador (POST - precisa de autenticação)
        this.app.post('/api/observer/sensitivity', (req, res) => {
            const sensitivity = parseFloat(req.body.sensitivity);
            console.log(`[WEB PANEL] Recebida requisição para atualizar sensibilidade do observador para: ${sensitivity}`);
            try {
                if (this.bot.streamObserver) {
                    this.bot.streamObserver.updateSensitivity(sensitivity);
                    console.log(`[WEB PANEL] Sensibilidade do observador atualizada para ${sensitivity} com sucesso (em memória).`);
                    // IMPORTANTE: A sensibilidade do observador é atualizada em memória.
                    // Para persistir, a configuração 'observer.sensitivity' precisaria ser salva em um arquivo.
                    res.json({ success: true, message: 'Sensibilidade do observador atualizada' });
                } else {
                    console.warn('[WEB PANEL] Tentativa de atualizar sensibilidade do observador, mas Observador de Stream não está ativo.');
                    res.status(400).json({ success: false, message: 'Observador de Stream não está ativo' });
                }
            } catch (error) {
                console.error(`[WEB PANEL ERROR] Erro ao atualizar sensibilidade do observador para ${sensitivity}:`, error.message);
                res.status(400).json({ success: false, message: error.message });
            }
        });

        // API - Filtros de palavras (GET - não precisa de autenticação)
        this.app.get('/api/filters/words', (req, res) => {
            res.json(this.config.filters?.bannedWords || []);
        });

        // API - Atualizar Filtros de palavras (POST - precisa de autenticação)
        this.app.post('/api/filters/words', (req, res) => {
            const words = req.body.words || [];
            console.log('[WEB PANEL] Recebida requisição para atualizar filtros de palavras.');
            try {
                // Certifica-se que 'filters' e 'bannedWords' existem para evitar erros
                if (!this.config.filters) {
                    this.config.filters = {};
                }
                this.config.filters.bannedWords = words;
                console.log('[WEB PANEL] Filtros de palavras atualizados com sucesso (em memória).');
                // IMPORTANTE: Os filtros de palavras são atualizados em memória.
                // Para persistir, a configuração 'filters.bannedWords' precisaria ser salva em um arquivo.
                res.json({ success: true, message: 'Filtros atualizados' });
            } catch (error) {
                console.error('[WEB PANEL ERROR] Erro ao atualizar filtros de palavras:', error.message);
                res.status(400).json({ success: false, message: error.message });
            }
        });

        // API - Logs do sistema (GET - não precisa de autenticação)
        this.app.get('/api/logs', (req, res) => {
            // Placeholder para logs do sistema
            // Em uma aplicação real, você buscaria logs de um serviço de log
            res.json([
                { timestamp: new Date().toISOString(), level: 'info', message: 'Bot inicializado' },
                { timestamp: new Date().toISOString(), level: 'info', message: 'Painel web ativo' }
            ]);
        });

        // --- NOVAS ROTAS PARA MEMÓRIA DE JOGOS ---
        // API - Obter memória de jogos (GET - não precisa de autenticação)
        this.app.get('/api/game-memory', async (req, res) => {
            try {
                // Acessa o gameMemoryService através da instância do bot
                // Se `_loadMemory` é o método pretendido para leitura externa, ok.
                // Caso contrário, considere criar um método público como `getGameMemory()`.
                if (this.bot.gameMemoryService) {
                    const gameMemory = await this.bot.gameMemoryService._loadMemory(); 
                    res.json(gameMemory);
                } else {
                    console.warn('[WEB PANEL] Tentativa de obter memória de jogos, mas gameMemoryService não está ativo.');
                    res.status(400).json({ success: false, message: 'gameMemoryService não está ativo.' });
                }
            } catch (error) {
                console.error('[WEB PANEL ERROR] Erro ao obter memória de jogos:', error.message);
                res.status(500).json({ success: false, message: 'Erro ao obter memória de jogos.' });
            }
        });

        // API - Atualizar memória de jogos manualmente (POST - precisa de autenticação)
        this.app.post('/api/game-memory/update', async (req, res) => {
            console.log('[WEB PANEL] Recebida requisição para atualizar memória de jogos manualmente.');
            try {
                // Acessa o gameMemoryService através da instância do bot
                if (this.bot.gameMemoryService) {
                    await this.bot.gameMemoryService.updateGameMemory();
                    console.log('[WEB PANEL] Memória de jogos atualizada manualmente com sucesso.');
                    // IMPORTANTE: A atualização da memória de jogos é persistida pelo gameMemoryService.
                    res.json({ success: true, message: 'Memória de jogos atualizada com sucesso!' });
                } else {
                    console.warn('[WEB PANEL] Tentativa de atualizar memória de jogos, mas gameMemoryService não está ativo.');
                    res.status(400).json({ success: false, message: 'gameMemoryService não está ativo.' });
                }
            } catch (error) {
                console.error('[WEB PANEL ERROR] Erro ao atualizar memória de jogos manualmente:', error.message);
                res.status(500).json({ success: false, message: 'Erro ao atualizar memória de jogos.' });
            }
        });
        // --- FIM NOVAS ROTAS ---
    }

    /**
     * Obtém status geral do bot
     */
    getBotStatus() {
        return {
            isConnected: this.bot.twitchClient?.isConnected || false,
            features: {
                chatCommands: !!this.bot.chatCommands,
                twitchEvents: !!this.bot.twitchEvents,
                streamObserver: this.bot.streamObserver?.isObserving || false,
                generativeAI: this.bot.generativeAI?.isActive || false,
                autoClipping: this.bot.autoClipper?.isActive || false,
                gameMemory: !!this.bot.gameMemoryService // Adiciona status do gameMemoryService
            },
            uptime: Date.now() - (this.bot.startTime || Date.now()),
            channels: this.config.twitch.channels
        };
    }

    /**
     * Atualiza configuração do bot
     * IMPORTANTE: Esta função atualiza a configuração em memória (this.config).
     * Para que as mudanças sejam permanentes após um reinício, você precisaria
     * salvar this.config em um arquivo de configuração (ex: config.json).
     */
    updateConfig(newConfig) {
        // Validar configuração (adicionar validações mais robustas conforme necessário)
        if (!newConfig || typeof newConfig !== 'object') {
            throw new Error('Configuração inválida: deve ser um objeto.');
        }
        
        // Atualizar configuração. Usa Object.assign para mesclar propriedades.
        // Cuidado: se newConfig não contiver todas as propriedades, as existentes não serão removidas.
        Object.assign(this.config, newConfig);
        
        // Aplicar mudanças nos módulos ativos
        // Supondo que newConfig.ai contenha propriedades como intensity e sensitivity
        if (this.bot.generativeAI && newConfig.ai?.intensity !== undefined) {
            this.bot.generativeAI.updateIntensity(newConfig.ai.intensity);
        }
        if (this.bot.streamObserver && newConfig.ai?.sensitivity !== undefined) { 
            this.bot.streamObserver.updateSensitivity(newConfig.ai.sensitivity);
        }
    }

    /**
     * Liga/desliga camadas do bot
     * IMPORTANTE: Similar a updateConfig, o estado da camada (enabled/disabled)
     * não é persistido automaticamente.
     */
    toggleLayer(layer, enabled) {
        switch (layer) {
            case 'streamObserver':
                if (this.bot.streamObserver) {
                    if (enabled) {
                        this.bot.streamObserver.startObserving();
                    } else {
                        this.bot.streamObserver.stopObserving();
                    }
                } else {
                    throw new Error('Módulo Observador de Stream não disponível.');
                }
                break;
            case 'generativeAI':
                if (this.bot.generativeAI) {
                    if (enabled) {
                        this.bot.generativeAI.activate();
                    } else {
                        this.bot.generativeAI.deactivate();
                    }
                } else {
                    throw new Error('Módulo IA Generativa não disponível.');
                }
                break;
            case 'autoClipping':
                if (this.bot.autoClipper) {
                    if (enabled) {
                        this.bot.autoClipper.activate();
                    } else {
                        this.bot.autoClipper.deactivate();
                    }
                } else {
                    throw new Error('Módulo Clipping Automático não disponível.');
                }
                break;
            case 'gameMemory': // Adicionado toggle para gameMemoryService, se ele tiver métodos activate/deactivate
                if (this.bot.gameMemoryService) {
                    // Assumindo que gameMemoryService tem métodos activate/deactivate
                    if (enabled) {
                        this.bot.gameMemoryService.activate(); 
                    } else {
                        this.bot.gameMemoryService.deactivate();
                    }
                } else {
                    throw new Error('Módulo Game Memory Service não disponível.');
                }
                break;
            // Se quiser que chatCommands e twitchEvents sejam toggleable via API,
            // adicione os cases aqui e a lógica de ativação/desativação nos módulos.
            default:
                throw new Error(`Camada desconhecida: ${layer}`);
        }

        // Atualizar configuração (se a camada for uma das controladas por features)
        // Garante que 'features' existe antes de tentar acessar 'layer'
        if (this.config.bot?.features && this.config.bot.features.hasOwnProperty(layer)) {
            this.config.bot.features[layer] = enabled;
        }
    }

    /**
     * Inicia o servidor web
     */
    start(port = 8080) {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(port, '0.0.0.0', (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log(`[WEB PANEL] Painel de controle web iniciado na porta ${port}`);
                    console.log(`[WEB PANEL] Acesse: http://localhost:${port}`);
                    resolve();
                }
            });
        });
    }

    /**
     * Para o servidor web
     */
    stop() {
        if (this.server) {
            this.server.close((err) => {
                if (err) {
                    console.error('[WEB PANEL ERROR] Erro ao parar o painel web:', err.message);
                } else {
                    console.log('[WEB PANEL] Painel de controle web parado');
                }
            });
        }
    }
}

module.exports = WebPanel;