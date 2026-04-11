import { ChannelType, GuildVerificationLevel } from "discord.js";
import { GuildCommand } from "../../types";
import { createInfoEmbed } from "../../utils/embedBuilder";
import { formatDate } from "../../utils/commandUtils";

const serverinfo: GuildCommand = {
  name: "serverinfo",
  description: "Displays detailed information about the current server.",
  conf: {
    guildOnly: true,
  },
  async execute(ctx) {
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
