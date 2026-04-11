import { ApplicationCommandOptionType } from "discord.js";
import { GuildCommand } from "../../../types";
import { createErrorEmbed, createInfoEmbed } from "../../../utils/embedBuilder";
import {
  resolveTargetMember,
  assertBotPermission,
  executeModerationAction,
} from "../../../utils/moderationHelpers";

const timeout: GuildCommand = {
  name: "timeout",
  description:
    "Temporarily stops a user from sending messages or joining voice channels.",
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
    const targetMember = await resolveTargetMember(ctx, "target", 0);
    if (!targetMember) return;

    const durationMinutes = ctx.parseInteger("duration", 1);
    const reason = ctx.parseString("reason", 2, true) || "No reason provided.";

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

    if (!(await assertBotPermission(ctx, targetMember, "timeout"))) {
      return;
    }

    const success = await executeModerationAction(
      ctx,
      async () => {
        await targetMember.timeout(durationMinutes * 60 * 1000, reason);
      },
      "timeout"
    );

    if (success) {
      await ctx.reply({
        embeds: [
          createInfoEmbed(
            ctx,
            `Successfully timed out <@${targetMember.user.id}>`,
            `Duration: ${durationMinutes} minute(s).\nReason: ${reason}`
          ),
        ],
      });
    }
  },
};

export default timeout;
