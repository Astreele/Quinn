import { ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";
import { Command } from "../../types";

const lock: Command = {
    name: "lock",
    description: "Locks down a channel, preventing regular members from sending messages.",
    category: "moderation",
    conf: {
        modOnly: true,
    },
    options: [
        {
            name: "channel",
            description: "The channel to lock (defaults to current channel)",
            type: ApplicationCommandOptionType.Channel,
            required: false,
        },
        {
            name: "reason",
            description: "Reason for the lockdown",
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
        
        // Reason parsing depends on whether standard channel wasn't given
        let reason: string | null = null;
        if (parsedChannel) {
            reason = ctx.parseString("reason", 1, true);
        } else {
            reason = ctx.parseString("reason", 0, true) || ctx.parseString("reason", 1, true);
        }
        
        reason = reason || "No reason provided.";

        if (!targetChannel || !("permissionOverwrites" in targetChannel)) {
            await ctx.reply("Could not lock this type of channel.");
            return;
        }

        const overwrite = targetChannel.permissionOverwrites.cache.get(ctx.guild.id);
        if (overwrite && overwrite.deny.has(PermissionFlagsBits.SendMessages)) {
            if (targetChannel.id === ctx.channel?.id) {
                await ctx.reply("This channel is already locked.");
            } else {
                await ctx.reply(`<#${targetChannel.id}> is already locked.`);
            }
            return;
        }

        try {
            await targetChannel.permissionOverwrites.edit(ctx.guild.id, {
                SendMessages: false,
                AddReactions: false,
                SendMessagesInThreads: false
            }, { reason });

            if (targetChannel.id !== ctx.channel?.id) {
                await ctx.reply(`Successfully locked <#${targetChannel.id}>. Reason: ${reason}`);
            } else {
                await ctx.reply(`🔒 This channel has been locked. Reason: ${reason}`);
            }
        } catch (error) {
            console.error(error);
            await ctx.reply("An error occurred while trying to lock the channel. Check my permissions.");
        }
    }
};

export default lock;
