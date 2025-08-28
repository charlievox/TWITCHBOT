/**
 * Módulo de Clipping Automático
 * Cria clips automaticamente via Twitch API quando momentos críticos são detectados
 */

const axios = require('axios');

class AutoClipper {
    constructor(config) {
        this.config = config;
        this.clientId = process.env.TWITCH_CLIENT_ID || '';
        this.accessToken = process.env.TWITCH_ACCESS_TOKEN || '';
        this.baseURL = 'https://api.twitch.tv/helix';
        
        this.isActive = false;
        this.clipQueue = [];
        this.recentClips = [];
        this.clipCooldown = 60000; // 1 minuto entre clips
        this.lastClipTime = 0;
        
        this.clipProcessor = null;
    }

    /**
     * Ativa o sistema de clipping automático
     */
    activate() {
        if (this.isActive) {
            console.log('Auto Clipper já está ativo');
            return;
        }

        console.log('Ativando Auto Clipper...');
        this.isActive = true;
        
        // Processar fila de clips a cada 10 segundos
        this.clipProcessor = setInterval(() => {
            this.processClipQueue();
        }, 10000);

        console.log('Auto Clipper ativado');
    }

    /**
     * Desativa o sistema de clipping automático
     */
    deactivate() {
        if (!this.isActive) {
            console.log('Auto Clipper já está inativo');
            return;
        }

        console.log('Desativando Auto Clipper...');
        this.isActive = false;
        
        if (this.clipProcessor) {
            clearInterval(this.clipProcessor);
            this.clipProcessor = null;
        }

        console.log('Auto Clipper desativado');
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
     * Processa momento crítico para possível clipping
     */
    processCriticalMoment(moment) {
        if (!this.isActive) return;

        console.log(`Processando momento crítico para clip: ${moment.title}`);

        // Verificar se deve criar clip
        if (this.shouldCreateClip(moment)) {
            this.queueClip(moment);
        }
    }

    /**
     * Determina se deve criar clip para o momento
     */
    shouldCreateClip(moment) {
        // Verificar cooldown
        const timeSinceLastClip = Date.now() - this.lastClipTime;
        if (timeSinceLastClip < this.clipCooldown) {
            console.log('Clip ignorado devido ao cooldown');
            return false;
        }

        // Verificar se o evento é digno de clip
        if (!moment.clipWorthy) {
            return false;
        }

        // Verificar intensidade do evento
        if (moment.event && moment.event.intensity < 0.6) {
            return false;
        }

        return true;
    }

    /**
     * Adiciona clip à fila de processamento
     */
    queueClip(moment) {
        const clipData = {
            moment: moment,
            timestamp: Date.now(),
            title: this.generateClipTitle(moment),
            processed: false
        };

        this.clipQueue.push(clipData);
        console.log(`Clip adicionado à fila: ${clipData.title}`);
    }

    /**
     * Processa fila de clips
     */
    async processClipQueue() {
        if (this.clipQueue.length === 0) return;

        const clipData = this.clipQueue.shift();
        
        // Verificar se não passou muito tempo
        const timeDiff = Date.now() - clipData.timestamp;
        if (timeDiff > 120000) { // 2 minutos
            console.log('Clip ignorado - muito tempo passou');
            return;
        }

        await this.createClip(clipData);
    }

    /**
     * Cria clip via Twitch API
     */
    async createClip(clipData) {
        if (!this.clientId || !this.accessToken) {
            console.warn('Credenciais da Twitch não configuradas. Simulando criação de clip...');
            this.simulateClipCreation(clipData);
            return;
        }

        try {
            // Obter ID do broadcaster
            const broadcasterId = await this.getBroadcasterId();
            if (!broadcasterId) {
                console.error('Não foi possível obter ID do broadcaster');
                return;
            }

            // Criar clip
            const response = await axios.post(
                `${this.baseURL}/clips`,
                {
                    broadcaster_id: broadcasterId,
                    has_delay: false
                },
                { headers: this.getHeaders() }
            );

            const clipInfo = response.data.data[0];
            
            // Atualizar título do clip (se possível)
            await this.updateClipTitle(clipInfo.id, clipData.title);

            // Registrar clip criado
            this.registerClip(clipInfo, clipData);
            
            console.log(`Clip criado com sucesso: ${clipInfo.edit_url}`);
            this.lastClipTime = Date.now();

        } catch (error) {
            console.error('Erro ao criar clip:', error.response?.data || error.message);
            
            // Fallback para simulação
            this.simulateClipCreation(clipData);
        }
    }

    /**
     * Simula criação de clip para demonstração
     */
    simulateClipCreation(clipData) {
        const simulatedClip = {
            id: `sim_${Date.now()}`,
            url: `https://clips.twitch.tv/sim_${Date.now()}`,
            edit_url: `https://clips.twitch.tv/sim_${Date.now()}/edit`,
            title: clipData.title,
            created_at: new Date().toISOString(),
            simulated: true
        };

        this.registerClip(simulatedClip, clipData);
        console.log(`Clip simulado criado: ${simulatedClip.title}`);
        this.lastClipTime = Date.now();
    }

    /**
     * Obtém ID do broadcaster
     */
    async getBroadcasterId() {
        try {
            // Usar o primeiro canal configurado
            const channelName = this.config.twitch.channels[0]?.replace('#', '');
            if (!channelName) return null;

            const response = await axios.get(`${this.baseURL}/users`, {
                headers: this.getHeaders(),
                params: { login: channelName }
            });

            if (response.data.data.length === 0) {
                throw new Error(`Canal ${channelName} não encontrado`);
            }

            return response.data.data[0].id;
        } catch (error) {
            console.error('Erro ao obter ID do broadcaster:', error.message);
            return null;
        }
    }

    /**
     * Atualiza título do clip (funcionalidade limitada da API)
     */
    async updateClipTitle(clipId, title) {
        // NOTA: A API da Twitch não permite alterar o título de clips após criação
        // Esta função é um placeholder para futuras funcionalidades
        console.log(`Título desejado para clip ${clipId}: ${title}`);
    }

    /**
     * Registra clip criado
     */
    registerClip(clipInfo, clipData) {
        const clip = {
            id: clipInfo.id,
            url: clipInfo.url,
            editUrl: clipInfo.edit_url,
            title: clipData.title,
            moment: clipData.moment,
            createdAt: clipInfo.created_at || new Date().toISOString(),
            simulated: clipInfo.simulated || false
        };

        this.recentClips.push(clip);
        
        // Manter apenas os últimos 20 clips
        if (this.recentClips.length > 20) {
            this.recentClips.shift();
        }

        // Emitir evento para outros módulos
        this.emit('clipCreated', clip);
    }

    /**
     * Gera título para o clip
     */
    generateClipTitle(moment) {
        const baseTitle = moment.title || 'Momento Épico';
        const timestamp = new Date().toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        return `${baseTitle} - ${timestamp}`;
    }

    /**
     * Obtém clips recentes
     */
    getRecentClips(limit = 10) {
        return this.recentClips.slice(-limit);
    }

    /**
     * Obtém estatísticas do clipper
     */
    getStats() {
        return {
            isActive: this.isActive,
            queueLength: this.clipQueue.length,
            recentClipsCount: this.recentClips.length,
            lastClipTime: this.lastClipTime,
            cooldownRemaining: Math.max(0, this.clipCooldown - (Date.now() - this.lastClipTime))
        };
    }

    /**
     * Cria clip manual
     */
    async createManualClip(title = 'Clip Manual') {
        const manualMoment = {
            id: Date.now(),
            title: title,
            clipWorthy: true,
            event: { intensity: 1.0 },
            timestamp: Date.now()
        };

        this.queueClip(manualMoment);
        console.log(`Clip manual adicionado à fila: ${title}`);
    }

    /**
     * Atualiza configurações de cooldown
     */
    updateCooldown(cooldownMs) {
        this.clipCooldown = Math.max(30000, cooldownMs); // Mínimo 30 segundos
        console.log(`Cooldown atualizado para: ${this.clipCooldown}ms`);
    }

    /**
     * Sistema de eventos simples
     */
    emit(event, ...args) {
        if (this.listeners && this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(...args));
        }
    }

    on(event, callback) {
        if (!this.listeners) this.listeners = {};
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }

    /**
     * Limpa dados e reinicia
     */
    reset() {
        this.clipQueue = [];
        this.recentClips = [];
        this.lastClipTime = 0;
        console.log('Auto Clipper resetado');
    }
}

module.exports = AutoClipper;

