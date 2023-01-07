import { GuildMember, Interaction } from "discord.js";

export = {
    name: 'guildMemberUpdate',
    async execute(oldMember: GuildMember, newMember: GuildMember) {
        if (oldMember.id !== "640207743185321986") return;

        if (oldMember.nickname !== newMember.nickname)
        {
            newMember.setNickname("Matt (gay femboy bottom)");
        }
    },
};