import { ApplicationCommandOptionType } from "discord.js";
import { Command } from "../../types";

const timeout: Command = {
    name: "timeout",
    description: "Temporarily stops a user from sending messages or joining voice channels.",
    category: "moderation",
    conf: {
        modOnly: true,
        requireHierarchy: true,
    },
    options: [
        {
            name: "target",
            description: "The user to timeout",
            type: ApplicationCommandOptionType.User,
            required: true,
        },
        {
            name: "duration",
            description: "Duration in minutes (e.g., 10)",
            type: ApplicationCommandOptionType.Integer,
            required: true,
        },
        {
            name: "reason",
            description: "The reason for the timeout",
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
        const durationMinutes = ctx.parseInteger("duration", 1);
        const reason = ctx.parseString("reason", 2, true) || "No reason provided.";

        if (!targetMember) {
            await ctx.reply("Could not find that user in the server. Please specify a valid user.");
            return;
        }

        await ctx.defer();

        if (!durationMinutes || isNaN(durationMinutes) || durationMinutes < 1) {
            await ctx.reply("Please provide a valid duration in minutes.");
            return;
        }

        // Limit to discord max timeout (28 days)
        const maxMinutes = 28 * 24 * 60;
        if (durationMinutes > maxMinutes) {
            await ctx.reply("Duration cannot exceed 28 days.");
            return;
        }

        if (!targetMember.moderatable) {
            await ctx.reply("I do not have permission to timeout this user.");
            return;
        }

        try {
            const ms = durationMinutes * 60 * 1000;
            await targetMember.timeout(ms, reason);
            await ctx.reply(`Successfully timed out **${targetMember.user.tag}** for ${durationMinutes} minute(s). Reason: ${reason}`);
        } catch (error) {
            console.error(error);
            await ctx.reply("An error occurred while trying to timeout the user.");
        }
    }
};

export default timeout;
