import { ApplicationCommandOptionType } from "discord.js";
import { GuildCommand } from "../../../types";
import { createErrorEmbed, createInfoEmbed } from "../../../utils/embedBuilder";

const whoIs: GuildCommand = {
  name: "whois",
  description: "Displays detailed information about a user.",
  conf: {
    guildOnly: true,
  },
  options: [
    {
      name: "user",
      description: "The user to inspect",
      type: ApplicationCommandOptionType.User,
      required: false,
    },
  ],
  async execute(ctx) {
    function formatDate(date: Date): string {
      const formatter = new Intl.DateTimeFormat("en-GB", {
        timeZone: "UTC",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      const parts = Object.fromEntries(
        formatter.formatToParts(date).map((p) => [p.type, p.value])
      );

      const day = Number(parts.day);

      const suffix =
        day > 3 && day < 21
          ? "th"
          : ["th", "st", "nd", "rd"][Math.min(day % 10, 3)];

      const unix = Math.floor(date.getTime() / 1000);
      return `${day}${suffix} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute} ${parts.dayPeriod.toUpperCase()} (<t:${unix}:R>)`;
    }

    function formatRoles(memberRoles: string[]): string {
      if (memberRoles.length === 0) {
        return "None";
      }

      const visibleRoles = memberRoles.slice(0, 10).join(", ");
      const remainingRoles = memberRoles.length - 10;

      if (remainingRoles <= 0) {
        return visibleRoles;
      }

      return `${visibleRoles} and ${remainingRoles} more`;
    }

    const targetMember = (await ctx.parseMember("user", 0)) ?? ctx.member;

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

    const roleMentions = targetMember.roles.cache
      .filter((role) => role.id !== ctx.guild.id)
      .sort((a, b) => b.position - a.position)
      .map((role) => role.toString());

    const embed = createInfoEmbed(ctx, `User Info: <@${targetMember.user.id}>`)
      .setThumbnail(
        targetMember.displayAvatarURL({ extension: "png", size: 1024 })
      )
      .addFields(
        {
          name: "User",
          value: `<@${targetMember.user.id}>`,
          inline: false,
        },
        {
          name: "Nickname",
          value: targetMember.nickname ?? "None",
          inline: true,
        },
        {
          name: "Bot Account",
          value: targetMember.user.bot ? "Yes" : "No",
          inline: true,
        },
        {
          name: "Highest Role",
          value: targetMember.roles.highest.toString(),
          inline: true,
        },
        {
          name: "Account Created",
          value: formatDate(targetMember.user.createdAt),
          inline: true,
        },
        {
          name: "Joined Server",
          value: targetMember.joinedAt
            ? formatDate(targetMember.joinedAt)
            : "Unknown",
          inline: true,
        },
        {
          name: `Roles (${roleMentions.length})`,
          value: formatRoles(roleMentions),
          inline: false,
        }
      );

    await ctx.reply({
      embeds: [embed],
    });
  },
};

export default whoIs;
