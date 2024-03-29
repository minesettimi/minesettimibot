import { Interaction, InteractionType } from "discord.js";

export = {
    name: 'interactionCreate',
    async execute(interaction : Interaction) {
        if (!interaction.isChatInputCommand()) return;

        if (interaction.type !== InteractionType.ApplicationCommand) return;

        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Command failed to execute!', ephemeral: true});
        }
    },
};