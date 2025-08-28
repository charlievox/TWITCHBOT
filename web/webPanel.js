/**
 * Painel de Controle Web
 * Servidor Express.js para interface de controle do bot
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

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
    }

    /**
     * Configura rotas da API
     */
    setupRoutes() {
        // Página principal
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });

        // API - Status geral do bot
        this.app.get('/api/status', (req, res) => {
            res.json(this.getBotStatus());
        });

        // API - Configurações
        this.app.get('/api/config', (req, res) => {
            res.json(this.config);
        });

        this.app.post('/api/config', (req, res) => {
            try {
                this.updateConfig(req.body);
                res.json({ success: true, message: 'Configuração atualizada' });
            } catch (error) {
                res.status(400).json({ success: false, message: error.message });
            }
        });

        // API - Controle de camadas
        this.app.post('/api/layers/:layer/toggle', (req, res) => {
            try {
                const layer = req.params.layer;
                const enabled = req.body.enabled;
                this.toggleLayer(layer, enabled);
                res.json({ success: true, message: `Camada ${layer} ${enabled ? 'ativada' : 'desativada'}` });
            } catch (error) {
                res.status(400).json({ success: false, message: error.message });
            }
        });

        // API - Estatísticas de gameplay
        this.app.get('/api/gameplay/stats', (req, res) => {
            if (this.bot.streamObserver) {
                res.json(this.bot.streamObserver.getGameplayStats());
            } else {
                res.json({});
            }
        });

        // API - Momentos críticos
        this.app.get('/api/gameplay/moments', (req, res) => {
            if (this.bot.streamObserver) {
                res.json(this.bot.streamObserver.getCriticalMoments());
            } else {
                res.json([]);
            }
        });

        // API - Clips recentes
        this.app.get('/api/clips', (req, res) => {
            if (this.bot.autoClipper) {
                res.json(this.bot.autoClipper.getRecentClips());
            } else {
                res.json([]);
            }
        });

        // API - Criar clip manual
        this.app.post('/api/clips/manual', (req, res) => {
            try {
                const title = req.body.title || 'Clip Manual';
                if (this.bot.autoClipper) {
                    this.bot.autoClipper.createManualClip(title);
                    res.json({ success: true, message: 'Clip manual criado' });
                } else {
                    res.status(400).json({ success: false, message: 'Auto Clipper não está ativo' });
                }
            } catch (error) {
                res.status(400).json({ success: false, message: error.message });
            }
        });

        // API - Estatísticas da IA
        this.app.get('/api/ai/stats', (req, res) => {
            if (this.bot.generativeAI) {
                res.json(this.bot.generativeAI.getStats());
            } else {
                res.json({ isActive: false });
            }
        });

        // API - Atualizar intensidade da IA
        this.app.post('/api/ai/intensity', (req, res) => {
            try {
                const intensity = parseFloat(req.body.intensity);
                if (this.bot.generativeAI) {
                    this.bot.generativeAI.updateIntensity(intensity);
                    res.json({ success: true, message: 'Intensidade da IA atualizada' });
                } else {
                    res.status(400).json({ success: false, message: 'IA Generativa não está ativa' });
                }
            } catch (error) {
                res.status(400).json({ success: false, message: error.message });
            }
        });

        // API - Atualizar sensibilidade do observador
        this.app.post('/api/observer/sensitivity', (req, res) => {
            try {
                const sensitivity = parseFloat(req.body.sensitivity);
                if (this.bot.streamObserver) {
                    this.bot.streamObserver.updateSensitivity(sensitivity);
                    res.json({ success: true, message: 'Sensibilidade do observador atualizada' });
                } else {
                    res.status(400).json({ success: false, message: 'Observador de Stream não está ativo' });
                }
            } catch (error) {
                res.status(400).json({ success: false, message: error.message });
            }
        });

        // API - Filtros de palavras
        this.app.get('/api/filters/words', (req, res) => {
            res.json(this.config.filters?.bannedWords || []);
        });

        this.app.post('/api/filters/words', (req, res) => {
            try {
                const words = req.body.words || [];
                this.config.filters.bannedWords = words;
                res.json({ success: true, message: 'Filtros atualizados' });
            } catch (error) {
                res.status(400).json({ success: false, message: error.message });
            }
        });

        // API - Logs do sistema
        this.app.get('/api/logs', (req, res) => {
            // Placeholder para logs do sistema
            res.json([
                { timestamp: new Date().toISOString(), level: 'info', message: 'Bot inicializado' },
                { timestamp: new Date().toISOString(), level: 'info', message: 'Painel web ativo' }
            ]);
        });
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
                autoClipping: this.bot.autoClipper?.isActive || false
            },
            uptime: Date.now() - (this.bot.startTime || Date.now()),
            channels: this.config.twitch.channels
        };
    }

    /**
     * Atualiza configuração do bot
     */
    updateConfig(newConfig) {
        // Validar configuração
        if (!newConfig.twitch || !newConfig.bot) {
            throw new Error('Configuração inválida');
        }

        // Atualizar configuração
        Object.assign(this.config, newConfig);
        
        // Aplicar mudanças nos módulos ativos
        if (this.bot.generativeAI && newConfig.ai) {
            this.bot.generativeAI.updateIntensity(newConfig.ai.intensity);
        }

        if (this.bot.streamObserver && newConfig.ai) {
            this.bot.streamObserver.updateSensitivity(newConfig.ai.sensitivity);
        }
    }

    /**
     * Liga/desliga camadas do bot
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
                }
                break;

            case 'generativeAI':
                if (this.bot.generativeAI) {
                    if (enabled) {
                        this.bot.generativeAI.activate();
                    } else {
                        this.bot.generativeAI.deactivate();
                    }
                }
                break;

            case 'autoClipping':
                if (this.bot.autoClipper) {
                    if (enabled) {
                        this.bot.autoClipper.activate();
                    } else {
                        this.bot.autoClipper.deactivate();
                    }
                }
                break;

            default:
                throw new Error(`Camada desconhecida: ${layer}`);
        }

        // Atualizar configuração
        this.config.bot.features[layer] = enabled;
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
                    console.log(`Painel de controle web iniciado na porta ${port}`);
                    console.log(`Acesse: http://localhost:${port}`);
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
            this.server.close();
            console.log('Painel de controle web parado');
        }
    }
}

module.exports = WebPanel;

