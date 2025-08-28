/**
 * Twitch Bot com IA Generativa
 * Arquivo principal que inicializa e coordena todas as camadas do bot
 */

const fs = require('fs');
const path = require('path');

// Importar módulos
const TwitchClient = require('./modules/twitchClient');
const ChatCommands = require('./modules/chatCommands');
const StreamObserver = require('./modules/streamObserver');
const AutoClipper = require('./modules/autoClipper');
const GenerativeAI = require('./ia/generativeAI');
const TwitchEvents = require('./events/twitchEvents');
const EventSubManager = require('./events/eventSubManager');
const WebPanel = require('./web/webPanel');

class TwitchBot {
    constructor() {
        this.config = this.loadConfig();
        this.twitchClient = null;
        this.chatCommands = null;
        this.streamObserver = null;
        this.autoClipper = null;
        this.generativeAI = null;
        this.twitchEvents = null;
        this.eventSubManager = null;
        this.webPanel = null;
        this.modules = {};
        this.startTime = Date.now();
    }

    /**
     * Carrega configuração do arquivo config.json
     */
    loadConfig() {
        try {
            const configPath = path.join(__dirname, 'config.json');
            const configData = fs.readFileSync(configPath, 'utf8');
            return JSON.parse(configData);
        } catch (error) {
            console.error('Erro ao carregar config.json:', error);
            process.exit(1);
        }
    }

    /**
     * Inicializa o bot e todas as suas camadas
     */
    async initialize() {
        console.log('Inicializando Twitch Bot...');

        try {
            // Camada 1: Conexão e Comandos de Chat
            if (this.config.bot.features.chatCommands) {
                await this.initializeChatLayer();
            }

            // Camada 2: Eventos Twitch
            if (this.config.bot.features.twitchEvents) {
                await this.initializeEventsLayer();
            }

            // Camada 3: Observador de Stream
            if (this.config.bot.features.streamObserver) {
                await this.initializeStreamObserverLayer();
            }

            // Camada 4: IA Generativa
            if (this.config.bot.features.generativeAI) {
                await this.initializeGenerativeAILayer();
            }

            // Camada 5: Clipping Automático
            if (this.config.bot.features.autoClipping) {
                await this.initializeAutoClippingLayer();
            }

            console.log('Bot inicializado com sucesso!');

            // Inicializar painel de controle web
            await this.initializeWebPanel();
        } catch (error) {
            console.error('Erro ao inicializar o bot:', error);
            process.exit(1);
        }
    }

    /**
     * Inicializa a camada de chat (Camada 1)
     */
    async initializeChatLayer() {
        console.log('Inicializando Camada 1: Conexão e Comandos de Chat...');

        // Criar cliente Twitch
        this.twitchClient = new TwitchClient(this.config);
        
        // Criar módulo de comandos de chat
        this.chatCommands = new ChatCommands(this.twitchClient, this.config);

        // Conectar eventos
        this.twitchClient.on('message', (channel, userstate, message) => {
            this.chatCommands.handleCommand(channel, userstate, message);
            
            // Processar mensagem com IA se ativa
            if (this.generativeAI) {
                this.generativeAI.processChatMessage(channel, userstate, message);
            }
        });

        // Conectar à Twitch
        await this.twitchClient.connect();
        
        console.log('Camada 1 inicializada com sucesso!');
    }

    /**
     * Inicializa a camada de eventos (Camada 2)
     */
    async initializeEventsLayer() {
        console.log('Inicializando Camada 2: Eventos Twitch...');

        // Criar módulo de eventos Twitch
        this.twitchEvents = new TwitchEvents(this.config, this.twitchClient);
        
        // Criar gerenciador de EventSub
        this.eventSubManager = new EventSubManager(this.config);

        // Iniciar servidor de webhooks
        await this.twitchEvents.start(3000);

        // Configurar inscrições EventSub (se credenciais estiverem disponíveis)
        try {
            await this.eventSubManager.setupSubscriptions();
        } catch (error) {
            console.warn('Não foi possível configurar EventSub. Usando modo de simulação.');
            // Ativar simulação de eventos para teste
            this.twitchEvents.simulateEvents();
        }

        console.log('Camada 2 inicializada com sucesso!');
    }

    /**
     * Inicializa a camada de observador de stream (Camada 3)
     */
    async initializeStreamObserverLayer() {
        console.log('Inicializando Camada 3: Observador de Stream...');

        // Criar módulo observador de stream
        this.streamObserver = new StreamObserver(this.config);

        // Conectar eventos do observador com outros módulos
        this.streamObserver.on('criticalMoment', (moment) => {
            console.log(`Momento crítico detectado: ${moment.title}`);
            
            // Enviar para auto clipper se ativo
            if (this.autoClipper) {
                this.autoClipper.processCriticalMoment(moment);
            }
        });

        this.streamObserver.on('gameplayEvent', (event) => {
            // Eventos de gameplay podem ser usados pela IA para contexto
            console.log(`Evento de gameplay: ${event.type} - ${event.context}`);
            
            // Enviar evento para IA se ativa
            if (this.generativeAI) {
                this.generativeAI.processGameplayEvent(event);
            }
        });

        // Iniciar observação se a funcionalidade estiver ativa
        this.streamObserver.startObserving();

        console.log('Camada 3 inicializada com sucesso!');
    }

    /**
     * Inicializa a camada de IA generativa (Camada 4)
     */
    async initializeGenerativeAILayer() {
        console.log('Inicializando Camada 4: IA Generativa...');

        // Verificar se OpenAI API key está configurada
        if (!process.env.OPENAI_API_KEY) {
            console.warn('OPENAI_API_KEY não configurada. IA Generativa não será ativada.');
            return;
        }

        // Criar módulo de IA generativa
        this.generativeAI = new GenerativeAI(this.config, this.twitchClient);

        // Ativar IA
        this.generativeAI.activate();

        // Sincronizar dados existentes
        if (this.streamObserver) {
            const stats = this.streamObserver.getGameplayStats();
            this.generativeAI.updateGameplayStats(stats);
        }

        if (this.chatCommands) {
            this.generativeAI.updateCurrentGame(this.chatCommands.currentGame);
        }

        console.log('Camada 4 inicializada com sucesso!');
    }

    /**
     * Inicializa a camada de clipping automático (Camada 5)
     */
    async initializeAutoClippingLayer() {
        console.log('Inicializando Camada 5: Clipping Automático...');

        // Criar módulo de clipping automático
        this.autoClipper = new AutoClipper(this.config);

        // Conectar eventos do clipper
        this.autoClipper.on('clipCreated', (clip) => {
            console.log(`Clip criado: ${clip.title} - ${clip.url}`);
            
            // Anunciar clip no chat se não for simulado
            if (!clip.simulated) {
                this.config.twitch.channels.forEach(channel => {
                    this.twitchClient.say(channel, `🎬 Novo clip criado: ${clip.title}! ${clip.url}`);
                });
            }
        });

        // Ativar clipping automático
        this.autoClipper.activate();

        console.log('Camada 5 inicializada com sucesso!');
    }

    /**
     * Inicializa o painel de controle web
     */
    async initializeWebPanel() {
        console.log('Inicializando Painel de Controle Web...');

        // Criar painel web
        this.webPanel = new WebPanel(this, this.config);

        // Iniciar servidor web
        await this.webPanel.start(8080);

        console.log('Painel de Controle Web inicializado com sucesso!');
    }

    /**
     * Encerra o bot graciosamente
     */
    shutdown() {
        console.log('Encerrando bot...');
        
        if (this.webPanel) {
            this.webPanel.stop();
        }
        
        if (this.autoClipper) {
            this.autoClipper.deactivate();
        }
        
        if (this.generativeAI) {
            this.generativeAI.deactivate();
        }
        
        if (this.streamObserver) {
            this.streamObserver.stopObserving();
        }
        
        if (this.twitchEvents) {
            this.twitchEvents.stop();
        }
        
        if (this.twitchClient) {
            this.twitchClient.disconnect();
        }
        
        console.log('Bot encerrado.');
        process.exit(0);
    }
}

// Inicializar o bot
const bot = new TwitchBot();

// Handlers para encerramento gracioso
process.on('SIGINT', () => bot.shutdown());
process.on('SIGTERM', () => bot.shutdown());

// Inicializar
bot.initialize().catch(error => {
    console.error('Erro fatal:', error);
    process.exit(1);
});

