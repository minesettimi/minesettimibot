import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import {randomRange} from "../random";

export = {
    data: new SlashCommandBuilder()
        .setName('roll')
        .setDescription('Roll a dice')
        .addStringOption(option => option.setName('roll').setDescription('Standard dice roll notation such as 1d20+5').setRequired(true))
        .addIntegerOption(option => option.setName('advantage').setDescription('Choose to have disadvantage or advantage')
        .addChoices(
            {name: 'Advantage', value: 1},
            {name: 'Disadvantage', value: 2},
        ))
        .addBooleanOption(option => option.setName('private').setDescription('Set if the roll will only be sent to you.')),
    async execute(interaction : ChatInputCommandInteraction) {
        const roll = interaction.options.getString("roll", true);
        const advantage = interaction.options.getInteger("advantage") ?? 0;
        const ephimeral = interaction.options.getBoolean("private") ?? true;

        let result: number = 0;

        const matches = roll.matchAll(/(\d+)d(\d+)(?=\+(\d+)|$| )/gm);

        if (matches == null)
        {
            await interaction.reply({content: 'Invalid roll name!', ephemeral: true});
            return;
        }

        try
        {
            for (const match of matches)
            {
                if (match[1] == null || match[2] == null)
                {
                    await interaction.reply({content: 'Invalid roll name!', ephemeral: true});
                    return;
                }

                let value = 0;
                let advValue = 0;

                const dice = parseInt(match[2]);

                for (let i = 0; i < parseInt(match[1]); i++)
                {
                    value += randomRange(0, dice);

                    if (advantage > 0)
                        advValue += randomRange(0, dice);
                }

                if (advantage == 1 && advValue > value)
                    value = advValue;
                else if (advantage == 2 && advValue < value)
                    value = advValue;

                if (match[3] != null)
                    value += parseInt(match[3]);

                result += value;
            }
        }
        catch (error)
        {
            await interaction.reply({content: 'Invalid roll name!', ephemeral: true});
            return;
        }

        await interaction.reply({content: `You rolled: ${result}. From the roll: ${roll}${advantage > 0 ? advantage == 1 ? " with advantage" : " with disadvantage" : ""}.`, ephemeral: ephimeral})
    }
}