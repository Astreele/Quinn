import {
    ApplicationCommandOptionType,
    PermissionFlagsBits,
    EmbedBuilder
} from "discord.js";
import { GuildCommand } from "../../types";

const lock: GuildCommand = {
    name: "lock",
    description:
        "Locks down a channel, preventing regular members from sending messages.",
    category: "moderation",
    conf: {
        modOnly: true,
        guildOnly: true
    },
    options: [
        {
            name: "channel",
            description: "The channel to lock (defaults to current channel)",
            type: ApplicationCommandOptionType.Channel,
            required: false
        },
        {
            name: "reason",
            description: "Reason for the lockdown",
            type: ApplicationCommandOptionType.String,
            required: false
        }
    ],
    async execute(ctx) {
        const parsedChannel = await ctx.parseChannel("channel", 0);
        let targetChannel = parsedChannel || ctx.channel;

        // Reason parsing depends on whether standard channel wasn't given
        let reason: string | null = null;
        if (parsedChannel) {
            reason = ctx.parseString("reason", 1, true);
        } else {
            reason =
                ctx.parseString("reason", 0, true) ||
                ctx.parseString("reason", 1, true);
        }

        const embed = new EmbedBuilder()
            .setFooter({ text: `Requested by ${ctx.author.username}` })
            .setTimestamp()
            .setColor("Red");

        reason = reason || "No reason provided.";

        if (!targetChannel || !("permissionOverwrites" in targetChannel)) {
            embed.setDescription("Could not lock this this channel.");
            await ctx.reply({ embeds: [embed] });
            return;
        }

        const overwrite = targetChannel.permissionOverwrites.cache.get(
            ctx.guild.id
        );
        if (overwrite && overwrite.deny.has(PermissionFlagsBits.SendMessages)) {
            if (targetChannel.id === ctx.channel?.id) {
                embed.setDescription("This channel is already locked.");
                await ctx.reply({ embeds: [embed] });
            } else {
                embed.setDescription(
                    `<#${targetChannel.id}> is already locked.`
                );
                await ctx.reply({ embeds: [embed] });
            }
            return;
        }

        try {
            await targetChannel.permissionOverwrites.edit(
                ctx.guild.id,
                {
                    SendMessages: false,
                    AddReactions: false,
                    SendMessagesInThreads: false
                },
                { reason }
            );

            if (targetChannel.id !== ctx.channel?.id) {
                embed
                    .setTitle(`Successfully locked <#${targetChannel.id}>.`)
                    .setDescription(`Reason: ${reason}`)
                    .setColor("Yellow");
                await ctx.reply({ embeds: [embed] });
            } else {
                embed
                    .setTitle("🔒 This channel has been locked.")
                    .setDescription(`Reason: ${reason}`)
                    .setColor("Yellow");
                await ctx.reply({ embeds: [embed] });
            }
        } catch (error) {
            console.error(error);
            embed
                .setTitle("An error occurred while trying to lock the channel.")
                .setDescription("Check my permissions.");
            await ctx.reply({ embeds: [embed] });
        }
    }
};

export default lock;
