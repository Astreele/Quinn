import { ApplicationCommandOptionType } from "discord.js";
import { Command } from "../../types";

const ban: Command = {
    name: "ban",
    description: "Bans a specified user from the server.",
    category: "moderation",
    conf: {
        modOnly: true,
        requireHierarchy: true,
    },
    options: [
        {
            name: "target",
            description: "The user to ban",
            type: ApplicationCommandOptionType.User,
            required: true,
        },
        {
            name: "reason",
            description: "The reason for banning the user",
            type: ApplicationCommandOptionType.String,
            required: false,
        }
    ],
    async execute(ctx) {
        if (!ctx.guild) {
            await ctx.reply("This command can only be used in a server.");
            return;
        }

        const targetUser = await ctx.parseUser("target", 0);
        const reason = ctx.parseString("reason", 1, true) || "No reason provided.";

        if (!targetUser) {
            await ctx.reply("Could not identify the user to ban. Please specify a valid user.");
            return;
        }

        await ctx.defer();

        try {
            // Attempt to fetch member to check hierarchy if they are in the server
            const member = await ctx.guild.members.fetch(targetUser.id).catch(() => null);
            if (member && !member.bannable) {
                await ctx.reply("I do not have permission to ban this user. Check my roles and permissions.");
                return;
            }

            // Attempt to DM the target user before banning (if they allow DMs)
            await targetUser.send(`You have been banned from **${ctx.guild.name}**. Reason: ${reason}`).catch(() => null);

            await ctx.guild.members.ban(targetUser.id, { reason });
            const userDisplay = targetUser.tag;
            await ctx.reply(`Successfully banned **${userDisplay}**. Reason: ${reason}`);
        } catch (error) {
            console.error(error);
            await ctx.reply("An error occurred while trying to ban the user.");
        }
    }
};

export default ban;
