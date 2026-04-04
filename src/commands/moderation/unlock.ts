import { ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";
import { Command } from "../../types";

const unlock: Command = {
    name: "unlock",
    description: "Unlocks a previously locked channel.",
    category: "moderation",
    conf: {
        modOnly: true,
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
        }
    ],
    async execute(ctx) {
        if (!ctx.guild) {
            await ctx.reply("This command can only be used in a server.");
            return;
        }

        const parsedChannel = await ctx.parseChannel("channel", 0);
        let targetChannel = parsedChannel || ctx.channel;
        
        let reason: string | null = null;
        if (parsedChannel) {
            reason = ctx.parseString("reason", 1, true);
        } else {
            reason = ctx.parseString("reason", 0, true) || ctx.parseString("reason", 1, true);
        }

        reason = reason || "No reason provided.";

        if (!targetChannel || !("permissionOverwrites" in targetChannel)) {
            await ctx.reply("Could not unlock this type of channel.");
            return;
        }

        const overwrite = targetChannel.permissionOverwrites.cache.get(ctx.guild.id);
        if (!overwrite || !overwrite.deny.has(PermissionFlagsBits.SendMessages)) {
            if (targetChannel.id === ctx.channel?.id) {
                await ctx.reply("This channel is not locked.");
            } else {
                await ctx.reply(`<#${targetChannel.id}> is not locked.`);
            }
            return;
        }

        try {
            await targetChannel.permissionOverwrites.edit(ctx.guild.id, {
                SendMessages: null,
                AddReactions: null,
                SendMessagesInThreads: null
            }, { reason });

            if (targetChannel.id !== ctx.channel?.id) {
                await ctx.reply(`Successfully unlocked <#${targetChannel.id}>. Reason: ${reason}`);
            } else {
                await ctx.reply(`🔓 This channel has been unlocked. Reason: ${reason}`);
            }
        } catch (error) {
            console.error(error);
            await ctx.reply("An error occurred while trying to unlock the channel. Check my permissions.");
        }
    }
};

export default unlock;
