import {
  ApplicationCommandOptionType,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { GuildCommand } from "../../types";

const unlock: GuildCommand = {
  name: "unlock",
  description: "Unlocks a previously locked channel.",
  category: "moderation",
  conf: {
    modOnly: true,
    guildOnly: true,
  },
  options: [
    {
      name: "channel",
      description: "The channel to unlock (defaults to current channel)",
      type: ApplicationCommandOptionType.Channel,
      required: false,
    },
    {
      name: "reason",
      description: "Reason for unlocking",
      type: ApplicationCommandOptionType.String,
      required: false,
    },
  ],
  async execute(ctx) {
    const parsedChannel = await ctx.parseChannel("channel", 0);
    let targetChannel = parsedChannel || ctx.channel;

    let reason: string | null = null;
    if (parsedChannel) {
      reason = ctx.parseString("reason", 1, true);
    } else {
      reason =
        ctx.parseString("reason", 0, true) ||
        ctx.parseString("reason", 1, true);
    }

    reason = reason || "No reason provided.";

    const embed = new EmbedBuilder()
      .setFooter({ text: `Requested by ${ctx.author.username}` })
      .setTimestamp()
      .setColor("Red");

    if (!targetChannel || !("permissionOverwrites" in targetChannel)) {
      embed.setDescription("Could not unlock this channel.");
      await ctx.reply({ embeds: [embed] });
      return;
    }

    const overwrite = targetChannel.permissionOverwrites.cache.get(
      ctx.guild.id
    );
    if (!overwrite || !overwrite.deny.has(PermissionFlagsBits.SendMessages)) {
      if (targetChannel.id === ctx.channel?.id) {
        embed.setDescription("This channel is not locked.");
        await ctx.reply({ embeds: [embed] });
      } else {
        embed.setDescription(`<#${targetChannel.id}> is not locked.`);
        await ctx.reply({ embeds: [embed] });
      }
      return;
    }

    try {
      await targetChannel.permissionOverwrites.edit(
        ctx.guild.id,
        {
          SendMessages: null,
          AddReactions: null,
          SendMessagesInThreads: null,
        },
        { reason }
      );

      if (targetChannel.id !== ctx.channel?.id) {
        embed
          .setTitle(`Successfully unlocked <#${targetChannel.id}>.`)
          .setDescription(`Reason: ${reason}`)
          .setColor("Yellow");
        await ctx.reply({ embeds: [embed] });
      } else {
        embed
          .setTitle("🔓 This channel has been unlocked.")
          .setDescription(`Reason: ${reason}`)
          .setColor("Yellow");
        await ctx.reply({ embeds: [embed] });
      }
    } catch (error) {
      console.error(error);
      embed.setDescription("I don't have permissions to unlock this channel.");
      await ctx.reply({ embeds: [embed] });
    }
  },
};

export default unlock;
