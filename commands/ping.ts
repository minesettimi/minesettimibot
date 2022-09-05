import { CommandInteraction, SlashCommandBuilder } from "discord.js";

export = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('pong'),
    async execute(interaction : CommandInteraction) {
        await interaction.reply('pong');
    }
}