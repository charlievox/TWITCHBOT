# 🤖 Twitch Bot com IA Generativa

Um bot completo, modular e pronto para uso para a plataforma Twitch, integrando funcionalidades de chat, eventos, observação de stream, IA generativa e clipping automático com painel de controle web.

## ✨ Funcionalidades Principais

### 🔗 Conexão e Autenticação Twitch
- Autenticação via OAuth2 usando tmi.js
- Conexão automática aos canais especificados
- Reconexão automática em caso de desconexão
- Mensagens de status no console e chat

### 📋 Camadas do Bot

#### 1️⃣ **Comandos do Chat**
- `!help` - Lista comandos disponíveis
- `!uptime` - Mostra tempo online do bot
- `!game` - Exibe jogo atual sendo jogado
- `!so <usuário>` - Shoutout para outro streamer

#### 2️⃣ **Eventos Twitch**
- Detecção de follows, subs e cheers via EventSub
- Mensagens personalizadas para cada tipo de evento
- Webhooks seguros com verificação de assinatura
- Modo de simulação para testes

#### 3️⃣ **Observador de Stream**
- Simulação de captura e análise de gameplay
- Detecção de momentos críticos (kills, vitórias, combos)
- Sistema de pontuação de intensidade
- Identificação automática de momentos dignos de clip

#### 4️⃣ **IA Generativa**
- Respostas contextuais usando OpenAI GPT
- Análise de chat e eventos de gameplay
- Personalidade configurável (criativa, empática, divertida)
- Filtros de conteúdo e controle de spam
- Intensidade ajustável

#### 5️⃣ **Clipping Automático**
- Criação automática de clips via Twitch API
- Títulos contextuais baseados no evento
- Sistema de cooldown para evitar spam
- Clips manuais via painel de controle

### 🌐 Painel de Controle Web
- Interface web moderna e responsiva
- Controle em tempo real de todas as camadas
- Monitoramento de estatísticas e status
- Configuração de filtros e sensibilidade
- Visualização de clips e momentos críticos

## 🚀 Instalação e Configuração

### Pré-requisitos
- Node.js 16.0.0 ou superior
- Conta na Twitch com aplicação registrada
- Chave da API OpenAI (opcional, para IA)

### 1. Clone e Instale
```bash
git clone <URL_DO_REPOSITORIO>
cd twitch-bot
npm install
```

### 2. Configure as Credenciais

#### Arquivo de Configuração
Copie o arquivo de exemplo e configure:
```bash
cp config.example.json config.json
```

Edite `config.json` com suas informações:
```json
{
  "twitch": {
    "username": "seu_bot_username",
    "oauth": "oauth:seu_oauth_token",
    "channels": ["#seu_canal"]
  }
}
```

#### Variáveis de Ambiente
Copie o arquivo de exemplo:
```bash
cp .env.example .env
```

Configure as variáveis em `.env`:
```env
TWITCH_CLIENT_ID=seu_client_id
TWITCH_ACCESS_TOKEN=seu_access_token
OPENAI_API_KEY=sk-sua_chave_openai
```

### 3. Execute o Bot
```bash
npm start
```

O bot iniciará e estará disponível em:
- **Chat**: Conectado aos canais configurados
- **Painel Web**: http://localhost:8080
- **Webhooks**: http://localhost:3000/webhooks/twitch

## 🔧 Configuração Detalhada

### Obtendo Credenciais da Twitch

#### 1. Client ID e Access Token
1. Acesse [Twitch Developers](https://dev.twitch.tv/console)
2. Crie uma nova aplicação
3. Anote o **Client ID**
4. Gere um **Access Token** com os escopos necessários:
   - `chat:read`
   - `chat:edit`
   - `clips:edit`
   - `channel:read:subscriptions`

#### 2. OAuth Token para Chat
1. Acesse [Twitch Chat OAuth Generator](https://twitchapps.com/tmi/)
2. Autorize a aplicação
3. Copie o token gerado (formato: `oauth:xxxxxx`)

#### 3. EventSub Webhooks
Para eventos em produção, configure um webhook público:
1. Use um serviço como ngrok para desenvolvimento
2. Configure a URL no arquivo `.env`
3. O bot criará automaticamente as inscrições necessárias

### Configurações Avançadas

#### IA Generativa
```json
{
  "ai": {
    "sensitivity": 0.5,    // 0-1: Sensibilidade para detectar momentos
    "intensity": 0.5       // 0-1: Frequência de respostas da IA
  }
}
```

#### Filtros de Conteúdo
```json
{
  "filters": {
    "bannedWords": ["palavra1", "palavra2"]
  }
}
```

#### Funcionalidades
```json
{
  "bot": {
    "features": {
      "chatCommands": true,     // Comandos básicos
      "twitchEvents": true,     // Eventos (follow, sub, cheer)
      "streamObserver": false,  // Observação de gameplay
      "generativeAI": false,    // IA generativa
      "autoClipping": false     // Clipping automático
    }
  }
}
```

## 📊 Painel de Controle

Acesse `http://localhost:8080` para:

- **Monitorar Status**: Conexão, uptime, canais
- **Controlar Camadas**: Ligar/desligar funcionalidades
- **Ajustar Configurações**: Sensibilidade da IA e observador
- **Ver Estatísticas**: Gameplay, clips, momentos críticos
- **Gerenciar Filtros**: Palavras banidas
- **Criar Clips**: Clips manuais com título personalizado

## 🏗️ Estrutura do Projeto

```
twitch-bot/
├── index.js                 # Arquivo principal
├── config.json             # Configurações do bot
├── package.json            # Dependências e scripts
├── README.md               # Este arquivo
├── modules/                # Módulos principais
│   ├── twitchClient.js     # Cliente Twitch (tmi.js)
│   ├── chatCommands.js     # Comandos de chat
│   ├── streamObserver.js   # Observador de stream
│   └── autoClipper.js      # Clipping automático
├── ia/                     # IA Generativa
│   └── generativeAI.js     # Módulo de IA
├── events/                 # Eventos Twitch
│   ├── twitchEvents.js     # Processador de eventos
│   └── eventSubManager.js  # Gerenciador EventSub
└── web/                    # Painel de controle web
    ├── webPanel.js         # Servidor Express
    └── public/             # Arquivos estáticos
        ├── index.html      # Interface principal
        ├── styles.css      # Estilos
        └── script.js       # JavaScript frontend
```

## 🔒 Considerações de Segurança

- **Rate Limits**: O bot respeita os limites da API da Twitch
- **Webhooks Seguros**: Verificação de assinatura HMAC
- **Filtros de Conteúdo**: Sistema de palavras banidas
- **Variáveis de Ambiente**: Credenciais não expostas no código
- **CORS Configurado**: Acesso controlado ao painel web

## 🎯 Comportamento da IA

A IA é projetada para ser:
- **Criativa e Empática**: Respostas naturais e envolventes
- **Contextual**: Considera chat e eventos de gameplay
- **Respeitosa**: Evita spam e conteúdo ofensivo
- **Configurável**: Intensidade e sensibilidade ajustáveis

## 🚨 Solução de Problemas

### Bot não conecta
- Verifique o OAuth token no `config.json`
- Confirme se os canais estão no formato `#canal`
- Verifique a conexão com a internet

### Eventos não funcionam
- Configure `TWITCH_CLIENT_ID` e `TWITCH_ACCESS_TOKEN`
- Verifique se o webhook está acessível publicamente
- Use o modo de simulação para testes

### IA não responde
- Configure `OPENAI_API_KEY` no arquivo `.env`
- Ative a funcionalidade no painel web
- Ajuste a intensidade da IA

### Clips não são criados
- Verifique permissões do access token
- Confirme se o streamer está ao vivo
- Use clips manuais para testar

## 📝 Logs e Monitoramento

O bot gera logs detalhados no console:
- Conexões e desconexões
- Eventos processados
- Erros e avisos
- Status das funcionalidades

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo LICENSE para detalhes.

## 🆘 Suporte

Para suporte e dúvidas:
- Abra uma issue no GitHub
- Consulte a documentação da Twitch API
- Verifique os logs do console

---

**Desenvolvido com ❤️ por Manus AI**

