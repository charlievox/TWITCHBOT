/**
 * JavaScript para o Painel de Controle do Twitch Bot
 */

// Estado global
let botStatus = {};
let updateInterval = null;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    initializePanel();
    startAutoUpdate();
});

/**
 * Inicializa o painel
 */
function initializePanel() {
    updateStatus();
    loadConfig();
    loadGameplayStats();
    loadClips();
    loadMoments();
    loadFilters();
}

/**
 * Inicia atualização automática
 */
function startAutoUpdate() {
    updateInterval = setInterval(() => {
        updateStatus();
        loadGameplayStats();
        loadClips();
        loadMoments();
    }, 5000); // Atualizar a cada 5 segundos
}

/**
 * Atualiza status do bot
 */
async function updateStatus() {
    try {
        const response = await fetch('/api/status');
        botStatus = await response.json();
        
        updateConnectionStatus();
        updateLayerToggles();
        updateUptimeDisplay();
        
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        showDisconnectedState();
    }
}

/**
 * Atualiza indicador de conexão
 */
function updateConnectionStatus() {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');
    const twitchConnection = document.getElementById('twitchConnection');
    const channels = document.getElementById('channels');
    
    if (botStatus.isConnected) {
        statusDot.classList.remove('disconnected');
        statusText.classList.remove('disconnected');
        statusText.textContent = 'Conectado';
        twitchConnection.textContent = 'Conectado';
        twitchConnection.style.color = '#10b981';
    } else {
        statusDot.classList.add('disconnected');
        statusText.classList.add('disconnected');
        statusText.textContent = 'Desconectado';
        twitchConnection.textContent = 'Desconectado';
        twitchConnection.style.color = '#ef4444';
    }
    
    channels.textContent = botStatus.channels ? botStatus.channels.join(', ') : 'Nenhum';
}

/**
 * Atualiza toggles das camadas
 */
function updateLayerToggles() {
    if (!botStatus.features) return;
    
    Object.keys(botStatus.features).forEach(feature => {
        const toggle = document.getElementById(feature);
        if (toggle) {
            toggle.checked = botStatus.features[feature];
        }
    });
}

/**
 * Atualiza display de uptime
 */
function updateUptimeDisplay() {
    const uptimeElement = document.getElementById('uptime');
    if (botStatus.uptime) {
        const hours = Math.floor(botStatus.uptime / (1000 * 60 * 60));
        const minutes = Math.floor((botStatus.uptime % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((botStatus.uptime % (1000 * 60)) / 1000);
        uptimeElement.textContent = `${hours}h ${minutes}m ${seconds}s`;
    } else {
        uptimeElement.textContent = '0h 0m 0s';
    }
}

/**
 * Mostra estado desconectado
 */
function showDisconnectedState() {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');
    
    statusDot.classList.add('disconnected');
    statusText.classList.add('disconnected');
    statusText.textContent = 'Erro de Conexão';
}

/**
 * Carrega configuração
 */
async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        
        // Atualizar sliders
        if (config.ai) {
            const aiIntensity = document.getElementById('aiIntensity');
            const observerSensitivity = document.getElementById('observerSensitivity');
            
            if (aiIntensity) {
                aiIntensity.value = config.ai.intensity || 0.5;
                document.getElementById('aiIntensityValue').textContent = aiIntensity.value;
            }
            
            if (observerSensitivity) {
                observerSensitivity.value = config.ai.sensitivity || 0.5;
                document.getElementById('observerSensitivityValue').textContent = observerSensitivity.value;
            }
        }
        
    } catch (error) {
        console.error('Erro ao carregar configuração:', error);
    }
}

/**
 * Carrega estatísticas de gameplay
 */
async function loadGameplayStats() {
    try {
        const response = await fetch('/api/gameplay/stats');
        const stats = await response.json();
        
        document.getElementById('kills').textContent = stats.kills || 0;
        document.getElementById('deaths').textContent = stats.deaths || 0;
        document.getElementById('wins').textContent = stats.wins || 0;
        document.getElementById('combos').textContent = stats.combos || 0;
        
    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
    }
}

/**
 * Carrega clips recentes
 */
async function loadClips() {
    try {
        const response = await fetch('/api/clips');
        const clips = await response.json();
        
        const clipsList = document.getElementById('clipsList');
        
        if (clips.length === 0) {
            clipsList.innerHTML = '<p class="no-data">Nenhum clip encontrado</p>';
            return;
        }
        
        clipsList.innerHTML = clips.map(clip => `
            <div class="clip-item">
                <div class="clip-info">
                    <h4>${clip.title}</h4>
                    <p>${new Date(clip.createdAt).toLocaleString('pt-BR')}</p>
                    ${clip.simulated ? '<p style="color: #f59e0b;">⚠️ Simulado</p>' : ''}
                </div>
                <a href="${clip.url}" target="_blank" class="clip-link">Ver Clip</a>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Erro ao carregar clips:', error);
    }
}

/**
 * Carrega momentos críticos
 */
async function loadMoments() {
    try {
        const response = await fetch('/api/gameplay/moments');
        const moments = await response.json();
        
        const momentsList = document.getElementById('momentsList');
        
        if (moments.length === 0) {
            momentsList.innerHTML = '<p class="no-data">Nenhum momento crítico detectado</p>';
            return;
        }
        
        momentsList.innerHTML = moments.map(moment => `
            <div class="moment-item">
                <h4>${moment.title}</h4>
                <p>${moment.event ? moment.event.context : 'Evento desconhecido'}</p>
                <span class="moment-time">${new Date(moment.timestamp).toLocaleString('pt-BR')}</span>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Erro ao carregar momentos:', error);
    }
}

/**
 * Carrega filtros de palavras
 */
async function loadFilters() {
    try {
        const response = await fetch('/api/filters/words');
        const words = await response.json();
        
        const textarea = document.getElementById('bannedWords');
        textarea.value = words.join('\\n');
        
    } catch (error) {
        console.error('Erro ao carregar filtros:', error);
    }
}

/**
 * Liga/desliga camada
 */
async function toggleLayer(layer, enabled) {
    try {
        const response = await fetch(`/api/layers/${layer}/toggle`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ enabled })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(result.message, 'success');
        } else {
            showNotification(result.message, 'error');
            // Reverter toggle em caso de erro
            document.getElementById(layer).checked = !enabled;
        }
        
    } catch (error) {
        console.error('Erro ao alternar camada:', error);
        showNotification('Erro ao alternar camada', 'error');
        document.getElementById(layer).checked = !enabled;
    }
}

/**
 * Atualiza intensidade da IA
 */
async function updateAIIntensity(value) {
    document.getElementById('aiIntensityValue').textContent = value;
    
    try {
        const response = await fetch('/api/ai/intensity', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ intensity: parseFloat(value) })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Intensidade da IA atualizada', 'success');
        } else {
            showNotification(result.message, 'error');
        }
        
    } catch (error) {
        console.error('Erro ao atualizar intensidade da IA:', error);
        showNotification('Erro ao atualizar intensidade da IA', 'error');
    }
}

/**
 * Atualiza sensibilidade do observador
 */
async function updateObserverSensitivity(value) {
    document.getElementById('observerSensitivityValue').textContent = value;
    
    try {
        const response = await fetch('/api/observer/sensitivity', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sensitivity: parseFloat(value) })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Sensibilidade do observador atualizada', 'success');
        } else {
            showNotification(result.message, 'error');
        }
        
    } catch (error) {
        console.error('Erro ao atualizar sensibilidade:', error);
        showNotification('Erro ao atualizar sensibilidade', 'error');
    }
}

/**
 * Cria clip manual
 */
async function createManualClip() {
    const title = prompt('Digite o título do clip:') || 'Clip Manual';
    
    try {
        const response = await fetch('/api/clips/manual', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Clip manual criado!', 'success');
            setTimeout(() => loadClips(), 2000); // Recarregar clips após 2 segundos
        } else {
            showNotification(result.message, 'error');
        }
        
    } catch (error) {
        console.error('Erro ao criar clip manual:', error);
        showNotification('Erro ao criar clip manual', 'error');
    }
}

/**
 * Atualiza filtros de palavras
 */
async function updateFilters() {
    const textarea = document.getElementById('bannedWords');
    const words = textarea.value.split('\\n').filter(word => word.trim() !== '');
    
    try {
        const response = await fetch('/api/filters/words', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ words })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Filtros atualizados!', 'success');
        } else {
            showNotification(result.message, 'error');
        }
        
    } catch (error) {
        console.error('Erro ao atualizar filtros:', error);
        showNotification('Erro ao atualizar filtros', 'error');
    }
}

/**
 * Mostra notificação
 */
function showNotification(message, type = 'info') {
    // Criar elemento de notificação
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Estilos da notificação
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 1000;
        animation: slideIn 0.3s ease;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    // Cores baseadas no tipo
    switch (type) {
        case 'success':
            notification.style.background = '#10b981';
            break;
        case 'error':
            notification.style.background = '#ef4444';
            break;
        default:
            notification.style.background = '#3b82f6';
    }
    
    // Adicionar ao DOM
    document.body.appendChild(notification);
    
    // Remover após 3 segundos
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Adicionar estilos de animação
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

