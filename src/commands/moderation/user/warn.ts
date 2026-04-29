import { ApplicationCommandOptionType } from "discord.js";
import { GuildCommand } from "../../../types";
import { createErrorEmbed, createInfoEmbed } from "../../../utils/embedBuilder";
import { dmUser, resolveTargetMember } from "../../../utils/moderationHelpers";
import { logger } from "../../../utils/logger";
import * as warningService from "../../../services/warningService";

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
    const client = ctx.client;
    if (!client.db) {
      await ctx.reply({
        embeds: [
          createErrorEmbed(
            ctx,
            "Database Error",
            "The database is not connected. Please try again later."
          ),
        ],
      });
      return;
    }

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
        embeds: [
          createErrorEmbed(ctx, "Invalid Target", "You cannot warn a bot."),
        ],
      });
      return;
    }

    try {
      const warning = await warningService.addWarning(client.db, {
        userDiscordId: targetMember.id,
        username: targetMember.user.username,
        discriminator: targetMember.user.discriminator,
        moderatorDiscordId: ctx.author.id,
        moderatorUsername: ctx.author.username,
        moderatorDiscriminator: ctx.author.discriminator,
        reason,
        guildId: ctx.guild.id,
        guildName: ctx.guild.name,
      });

      if (!warning) {
        throw new Error("Failed to create warning in database");
      }

      const warningCount =
        (await warningService.getWarningCount(
          client.db,
          targetMember.id,
          ctx.guild.id
        )) ?? 0;

      await dmUser(targetMember.user, ctx.guild.name, "warned", reason, ctx);

      await ctx.reply({
        embeds: [
          createInfoEmbed(
            ctx,
            `Successfully warned <@${targetMember.user.id}>.`,
            `This user now has ${warningCount} warning(s).`
          ),
        ],
      });
    } catch (error) {
      logger.error("Error during warn action:", error);
      await ctx.reply({
        embeds: [
          createErrorEmbed(
            ctx,
            "Error",
            "Failed to record the warning. Please try again or contact an administrator."
          ),
        ],
      });
    }
  },
};

export default warn;
