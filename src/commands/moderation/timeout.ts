import { ApplicationCommandOptionType } from "discord.js";
import { GuildCommand } from "../../types";
import { createErrorEmbed, createInfoEmbed } from "../../utils/embedBuilder";

const timeout: GuildCommand = {
  name: "timeout",
  description:
    "Temporarily stops a user from sending messages or joining voice channels.",
  category: "moderation",
  conf: {
    modOnly: true,
    requireHierarchy: true,
    guildOnly: true,
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
    },
  ],
  async execute(ctx) {
    const targetMember = await ctx.parseMember("target", 0);
    const durationMinutes = ctx.parseInteger("duration", 1);
    const reason = ctx.parseString("reason", 2, true) || "No reason provided.";

    if (!targetMember) {
      await ctx.reply({
        embeds: [
          createErrorEmbed(
            ctx,
            "Please specify a valid user.",
            "Could not find that user in the server."
          ),
        ],
      });
      return;
    }

    await ctx.defer();

    if (!durationMinutes || isNaN(durationMinutes) || durationMinutes < 1) {
      await ctx.reply({
        embeds: [
          createErrorEmbed(
            ctx,
            "Invalid Duration",
            "Please provide a valid duration in minutes."
          ),
        ],
      });
      return;
    }

    // Limit to discord max timeout (28 days)
    const maxMinutes = 28 * 24 * 60;
    if (durationMinutes > maxMinutes) {
      await ctx.reply({
        embeds: [
          createErrorEmbed(
            ctx,
            "Duration Too Long",
            "Duration cannot exceed 28 days."
          ),
        ],
      });
      return;
    }

    if (!targetMember.moderatable) {
      await ctx.reply({
        embeds: [
          createErrorEmbed(
            ctx,
            "Permission Denied",
            "I do not have permission to timeout this user."
          ),
        ],
      });
      return;
    }

    try {
      const ms = durationMinutes * 60 * 1000;
      await targetMember.timeout(ms, reason);
      await ctx.reply({
        embeds: [
          createInfoEmbed(
            ctx,
            `Successfully timed out <@${targetMember.user.id}>`,
            `Duration: ${durationMinutes} minute(s).\nReason: ${reason}`
          ),
        ],
      });
    } catch (error) {
      console.error(error);
      await ctx.reply({
        embeds: [
          createErrorEmbed(
            ctx,
            "Timeout Failed",
            "An error occurred while trying to timeout the user."
          ),
        ],
      });
    }
  },
};

export default timeout;
