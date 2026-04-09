import { ChannelType, GuildVerificationLevel } from "discord.js";
import { GuildCommand } from "../../types";
import { createInfoEmbed } from "../../utils/embedBuilder";

const serverinfo: GuildCommand = {
  name: "serverinfo",
  description: "Displays detailed information about the current server.",
  conf: {
    guildOnly: true,
  },
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

    const verificationLabels: Record<GuildVerificationLevel, string> = {
      [GuildVerificationLevel.None]: "None",
      [GuildVerificationLevel.Low]: "Low",
      [GuildVerificationLevel.Medium]: "Medium",
      [GuildVerificationLevel.High]: "High",
      [GuildVerificationLevel.VeryHigh]: "Very High",
    };
    const owner = await ctx.guild.fetchOwner();
    const textChannels = ctx.guild.channels.cache.filter((channel) =>
      [
        ChannelType.GuildText,
        ChannelType.GuildAnnouncement,
        ChannelType.PublicThread,
        ChannelType.PrivateThread,
        ChannelType.AnnouncementThread,
      ].includes(channel.type)
    ).size;
    const voiceChannels = ctx.guild.channels.cache.filter((channel) =>
      [ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(
        channel.type
      )
    ).size;

    const embed = createInfoEmbed(ctx, ctx.guild.name)
      .setThumbnail(ctx.guild.iconURL({ extension: "png", size: 1024 }))
      .addFields(
        {
          name: "Server ID",
          value: `\`${ctx.guild.id}\``,
          inline: true,
        },
        {
          name: "Owner",
          value: `<@${owner.user.id}>`,
          inline: true,
        },
        {
          name: "Created",
          value: formatDate(ctx.guild.createdAt),
          inline: true,
        },
        {
          name: "Members",
          value: `${ctx.guild.memberCount}`,
          inline: true,
        },
        {
          name: "Roles",
          value: `${ctx.guild.roles.cache.size}`,
          inline: true,
        },
        {
          name: "Emoji Count",
          value: `${ctx.guild.emojis.cache.size}`,
          inline: true,
        },
        {
          name: "Channels",
          value: `Text: ${textChannels}\nVoice: ${voiceChannels}\nTotal: ${ctx.guild.channels.cache.size}`,
          inline: true,
        },
        {
          name: "Boosts",
          value: `Level ${ctx.guild.premiumTier}\n${ctx.guild.premiumSubscriptionCount ?? 0} boosts`,
          inline: true,
        },
        {
          name: "Verification",
          value: verificationLabels[ctx.guild.verificationLevel],
          inline: true,
        }
      );

    await ctx.reply({ embeds: [embed] });
  },
};

export default serverinfo;
