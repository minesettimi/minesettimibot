import { Message } from "discord.js";

export = {
    name: 'messageCreate',
    async execute(message: Message)
    {
        if (message.author.id === '410488756811071498')
            message.reply("https://cdn.discordapp.com/attachments/1061711420804300932/1098272645818101932/IMG_7406.png");
    }
}