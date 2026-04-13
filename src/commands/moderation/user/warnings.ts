import { ApplicationCommandOptionType } from "discord.js";
import { GuildCommand } from "../../../types";
import { createErrorEmbed, createInfoEmbed } from "../../../utils/embedBuilder";
import { resolveTargetMember } from "../../../utils/moderationHelpers";
import * as warningService from "../../../services/warningService";

const WARNINGS_PER_PAGE = 10;

const warnings: GuildCommand = {
  name: "warnings",
  description: "Displays a list of previous warnings for a specific user.",
  conf: {
    modOnly: true,
    guildOnly: true,
  },
  options: [
    {
      name: "target",
      description: "The user to check warnings for",
      type: ApplicationCommandOptionType.User,
      required: true,
    },
    {
      name: "page",
      description: "The page number to view (default: 1)",
      type: ApplicationCommandOptionType.Integer,
      required: false,
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

    const page = Math.max(ctx.parseInteger("page", 1) ?? 1, 1);
    const limit = WARNINGS_PER_PAGE;
    const offset = (page - 1) * limit;

    try {
      const totalCount = await warningService.getWarningCount(
        client.db,
        targetMember.id,
        ctx.guild.id
      );

      if (totalCount === null || totalCount === 0) {
        await ctx.reply({
          embeds: [
            createInfoEmbed(
              ctx,
              `Warnings for <@${targetMember.user.id}>`,
              `<@${targetMember.user.id}> has no warnings.`
            ),
          ],
        });
        return;
      }

      const totalPages = Math.ceil(totalCount / limit);
      if (page > totalPages) {
        await ctx.reply({
          embeds: [
            createErrorEmbed(
              ctx,
              "Invalid Page",
              `There are only ${totalPages} page(s) of warnings for <@${targetMember.user.id}>.`
            ),
          ],
        });
        return;
      }

      const userWarnings = await warningService.getUserWarnings(
        client.db,
        targetMember.id,
        ctx.guild.id,
        { limit, offset }
      );

      if (!userWarnings || userWarnings.length === 0) {
        await ctx.reply({
          embeds: [
            createInfoEmbed(
              ctx,
              `Warnings for <@${targetMember.user.id}>`,
              `<@${targetMember.user.id}> has no warnings.`
            ),
          ],
        });
        return;
      }

      const warningList = userWarnings
        .map(
          (w, i) =>
            `**${offset + i + 1}.** [${w.createdAt.toLocaleDateString()}] ${w.reason}`
        )
        .join("\n");

      const footer = `Page ${page}/${totalPages} • ${totalCount} warning(s) total`;

      await ctx.reply({
        embeds: [
          createInfoEmbed(
            ctx,
            `Warnings for <@${targetMember.user.id}>`,
            warningList
          ).setFooter({ text: footer }),
        ],
      });
    } catch {
      await ctx.reply({
        embeds: [
          createErrorEmbed(
            ctx,
            "Error",
            "Failed to fetch warnings. Please try again or contact an administrator."
          ),
        ],
      });
    }
  },
};

export default warnings;
