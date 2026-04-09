import { ApplicationCommandOptionType } from "discord.js";
import { GuildCommand } from "../../../types";
import { createErrorEmbed, createInfoEmbed } from "../../../utils/embedBuilder";
import { dmUser, resolveTargetMember } from "../../../utils/moderationHelpers";
import { logger } from "../../../utils/logger";

// A basic map to store user warnings in memory.
// Structure: Map<guildId, Map<userId, { reason: string, date: Date }[]>>
export const warningsDB: Map<
  string,
  Map<string, { reason: string; date: Date }[]>
> = new Map();

const warn: GuildCommand = {
  name: "warn",
  description: "Issues a formal warning to a user.",
  conf: {
    modOnly: true,
    requireHierarchy: true,
    guildOnly: true,
  },
  options: [
    {
      name: "target",
      description: "The user to warn",
      type: ApplicationCommandOptionType.User,
      required: true,
    },
    {
      name: "reason",
      description: "The reason for the warning",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  async execute(ctx) {
    const targetMember = await resolveTargetMember(ctx, "target", 0);
    if (!targetMember) return;

    const reason = ctx.parseString("reason", 1, true);
    if (!reason) {
      await ctx.reply({
        embeds: [
          createErrorEmbed(ctx, "Missing Reason", "Please specify a reason."),
        ],
      });
      return;
    }

    if (targetMember.user.bot) {
      await ctx.reply({
        embeds: [createErrorEmbed(ctx, "Invalid Target", "You cannot warn a bot.")],
      });
      return;
    }

    // Save warning to memory
    if (!warningsDB.has(ctx.guild.id)) {
      warningsDB.set(ctx.guild.id, new Map());
    }

    const guildWarnings = warningsDB.get(ctx.guild.id)!;
    if (!guildWarnings.has(targetMember.id)) {
      guildWarnings.set(targetMember.id, []);
    }

    const userWarnings = guildWarnings.get(targetMember.id)!;
    userWarnings.push({ reason, date: new Date() });

    try {
      await dmUser(targetMember.user, ctx.guild.name, "warned", reason, ctx);

      await ctx.reply({
        embeds: [
          createInfoEmbed(
            ctx,
            `Successfully warned <@${targetMember.user.id}>.`,
            `This user now has ${userWarnings.length} warning(s).`
          ),
        ],
      });
    } catch (error) {
      logger.error("Error during warn action:", error);
      await ctx.reply({
        embeds: [
          createInfoEmbed(
            ctx,
            `Warning recorded for <@${targetMember.user.id}>`,
            "but I could not DM them."
          ),
        ],
      });
    }
  },
};

export default warn;
