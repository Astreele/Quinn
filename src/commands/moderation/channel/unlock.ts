import {
  ApplicationCommandOptionType,
  PermissionFlagsBits,
} from "discord.js";
import { GuildCommand } from "../../../types";
import { createErrorEmbed, createInfoEmbed } from "../../../utils/embedBuilder";

const unlock: GuildCommand = {
  name: "unlock",
  description: "Unlocks a previously locked channel.",
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

    if (!targetChannel || !("permissionOverwrites" in targetChannel)) {
      await ctx.reply({
        embeds: [
          createErrorEmbed(ctx, "Unlock Failed", "Could not unlock this channel."),
        ],
      });
      return;
    }

    const overwrite = targetChannel.permissionOverwrites.cache.get(
      ctx.guild.id
    );
    if (!overwrite || !overwrite.deny.has(PermissionFlagsBits.SendMessages)) {
      const location = targetChannel.id === ctx.channel?.id ? "This" : `<#${targetChannel.id}>`;
      await ctx.reply({
        embeds: [
          createErrorEmbed(ctx, "Not Locked", `${location} channel is not locked.`),
        ],
      });
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

      const location = targetChannel.id !== ctx.channel?.id ? `<#${targetChannel.id}>` : "🔓 This";
      await ctx.reply({
        embeds: [
          createInfoEmbed(
            ctx,
            `${location} channel has been unlocked.`,
            `Reason: ${reason}`
          ),
        ],
      });
    } catch (error) {
      console.error(error);
      await ctx.reply({
        embeds: [
          createErrorEmbed(
            ctx,
            "Unlock Failed",
            "I don't have permissions to unlock this channel."
          ),
        ],
      });
    }
  },
};

export default unlock;
