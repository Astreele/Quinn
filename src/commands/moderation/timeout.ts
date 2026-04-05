import { ApplicationCommandOptionType, EmbedBuilder } from "discord.js";
import { GuildCommand } from "../../types";

const timeout: GuildCommand = {
    name: "timeout",
    description:
        "Temporarily stops a user from sending messages or joining voice channels.",
    category: "moderation",
    conf: {
        modOnly: true,
        requireHierarchy: true,
        guildOnly: true
    },
    options: [
        {
            name: "target",
            description: "The user to timeout",
            type: ApplicationCommandOptionType.User,
            required: true
        },
        {
            name: "duration",
            description: "Duration in minutes (e.g., 10)",
            type: ApplicationCommandOptionType.Integer,
            required: true
        },
        {
            name: "reason",
            description: "The reason for the timeout",
            type: ApplicationCommandOptionType.String,
            required: false
        }
    ],
    async execute(ctx) {
        const targetMember = await ctx.parseMember("target", 0);
        const durationMinutes = ctx.parseInteger("duration", 1);
        const reason =
            ctx.parseString("reason", 2, true) || "No reason provided.";

        const embed = new EmbedBuilder()
            .setFooter({ text: `Requested by ${ctx.author.username}` })
            .setTimestamp()
            .setColor("Red");

        if (!targetMember) {
            embed
                .setTitle("Please specify a valid user.")
                .setDescription("Could not find that user in the server.");
            await ctx.reply({ embeds: [embed] });
            return;
        }

        await ctx.defer();

        if (!durationMinutes || isNaN(durationMinutes) || durationMinutes < 1) {
            embed.setDescription("Please provide a valid duration in minutes.");
            await ctx.reply({ embeds: [embed] });
            return;
        }

        // Limit to discord max timeout (28 days)
        const maxMinutes = 28 * 24 * 60;
        if (durationMinutes > maxMinutes) {
            embed.setDescription("Duration cannot exceed 28 days.");
            await ctx.reply({ embeds: [embed] });
            return;
        }

        if (!targetMember.moderatable) {
            embed.setDescription(
                "I do not have permission to timeout this user."
            );
            await ctx.reply({ embeds: [embed] });
            return;
        }

        try {
            const ms = durationMinutes * 60 * 1000;
            await targetMember.timeout(ms, reason);
            embed
                .setTitle(`Successfully timed out <@${targetMember.user.id}>`)
                .setDescription(
                    `Duration: ${durationMinutes} minute(s). \nReason: ${reason}`
                )
                .setColor("Yellow");
            await ctx.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            embed.setDescription(
                "An error occurred while trying to timeout the user."
            );
            await ctx.reply({ embeds: [embed] });
        }
    }
};

export default timeout;
