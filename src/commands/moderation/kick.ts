import { ApplicationCommandOptionType } from "discord.js";
import { Command } from "../../types";

const kick: Command = {
    name: "kick",
    description: "Kicks a specified user from the server.",
    category: "moderation",
    conf: {
        modOnly: true,
        requireHierarchy: true,
    },
    options: [
        {
            name: "target",
            description: "The user to kick",
            type: ApplicationCommandOptionType.User,
            required: true,
        },
        {
            name: "reason",
            description: "The reason for kicking the user",
            type: ApplicationCommandOptionType.String,
            required: false,
        }
    ],
    async execute(ctx) {
        if (!ctx.guild) {
            await ctx.reply("This command can only be used in a server.");
            return;
        }

        const targetMember = await ctx.parseMember("target", 0);
        const reason = ctx.parseString("reason", 1, true) || "No reason provided.";

        if (!targetMember) {
            await ctx.reply("Could not find that user in the server. Please specify a valid user.");
            return;
        }

        await ctx.defer();

        // Check if the bot can kick the user
        if (!targetMember.kickable) {
            await ctx.reply("I do not have permission to kick this user. Check my roles and permissions.");
            return;
        }

        try {
            // Attempt to DM the target user before kicking (if they allow DMs)
            await targetMember.send(`You have been kicked from **${ctx.guild.name}**. Reason: ${reason}`).catch(() => null);

            await targetMember.kick(reason);
            await ctx.reply(`Successfully kicked **${targetMember.user.tag}**. Reason: ${reason}`);
        } catch (error) {
            console.error(error);
            await ctx.reply("An error occurred while trying to kick the user.");
        }
    }
};

export default kick;