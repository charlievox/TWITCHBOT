/**
 * Módulo de Comandos de Chat
 * Gerencia todos os comandos básicos do bot no chat da Twitch
 */

class ChatCommands {
    constructor(client, config, autoClipper) {
        this.client = client;
        this.config = config;
        this.autoClipper = autoClipper; // Novo parâmetro
        this.startTime = Date.now();
        this.currentGame = "Jogo não detectado";
        
        this.commands = {
            help: this.helpCommand.bind(this),
            uptime: this.uptimeCommand.bind(this),
            game: this.gameCommand.bind(this),
            so: this.shoutoutCommand.bind(this),
            clip: this.clipCommand.bind(this)
        };
    }

    /**
     * Processa comandos recebidos no chat
     */
    handleCommand(channel, userstate, message) {
        if (!message.startsWith(this.config.bot.prefix)) return;

        const args = message.slice(this.config.bot.prefix.length).trim().split(' ');
        const command = args.shift().toLowerCase();

        if (this.commands[command]) {
            try {
                this.commands[command](channel, userstate, args);
            } catch (error) {
                console.error(`Erro ao executar comando ${command}:`, error);
            }
        }
    }

    /**
     * Comando !help - Lista comandos disponíveis
     */
    helpCommand(channel, userstate) {
        const helpMessage = `@${userstate.username} Comandos disponíveis: !help, !uptime, !game, !so <usuário>`;
        this.client.say(channel, helpMessage);
    }

    /**
     * Comando !uptime - Mostra há quanto tempo o bot está online
     */
    uptimeCommand(channel, userstate) {
        const uptime = Date.now() - this.startTime;
        const hours = Math.floor(uptime / (1000 * 60 * 60));
        const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((uptime % (1000 * 60)) / 1000);
        
        const uptimeMessage = `@${userstate.username} Bot online há: ${hours}h ${minutes}m ${seconds}s`;
        this.client.say(channel, uptimeMessage);
    }

    /**
     * Comando !game - Mostra o jogo atual sendo jogado
     */
    gameCommand(channel, userstate) {
        const gameMessage = `@${userstate.username} Jogo atual: ${this.currentGame}`;
        this.client.say(channel, gameMessage);
    }

    /**
     * Comando !so - Shoutout para outro streamer
     */
    shoutoutCommand(channel, userstate, args) {
        if (args.length === 0) {
            this.client.say(channel, `@${userstate.username} Use: !so <nome_do_usuário>`);
            return;
        }

        const targetUser = args[0].replace('@', '');
        const shoutoutMessage = `Deem uma olhada no canal do @${targetUser}! Eles fazem conteúdo incrível! https://twitch.tv/${targetUser}`;
        this.client.say(channel, shoutoutMessage);
    }

    /**
     * Atualiza o jogo atual (será chamado pela API da Twitch)
     */
    updateCurrentGame(gameName) {
        this.currentGame = gameName || "Jogo não detectado";
    }

    /**
     * Comando !clip - Cria um clip manual
     */
    async clipCommand(channel, userstate, args) {
        if (!this.autoClipper) {
            this.client.say(channel, `@${userstate.username} O sistema de clipping automático não está ativo.`);
            return;
        }

        // Opcional: verificar permissões (moderador/streamer)
        // if (!userstate.mod && userstate["room-id"] !== userstate["user-id"]) {
        //     this.client.say(channel, `@${userstate.username} Você não tem permissão para usar este comando.`);
        //     return;
        // }

        const title = args.join(" ").trim() || `Clip de ${userstate.username}`; // Título do clip

        try {
            await this.autoClipper.createManualClip(title);
            this.client.say(channel, `@${userstate.username} Clip manual solicitado: "${title}"!`);
        } catch (error) {
            console.error(`Erro ao criar clip manual para ${userstate.username}:`, error);
            this.client.say(channel, `@${userstate.username} Ocorreu um erro ao tentar criar o clip.`);
        }
    }
}

module.exports = ChatCommands;