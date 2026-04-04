import { ApplicationCommandOptionType, TextChannel, NewsChannel, ThreadChannel } from "discord.js";
import { Command } from "../../types";
import { CommandContext, MessageContext } from "../../context";

const clear: Command = {
    name: "clear",
    description: "Deletes a specified number of consecutive messages in a channel.",
    category: "moderation",
    conf: {
        modOnly: true,
    },
    options: [
        {
            name: "amount",
            description: "The number of messages to delete (1-100)",
            type: ApplicationCommandOptionType.Integer,
            required: true,
        }
    ],
    async execute(ctx) {
        if (!ctx.guild || !ctx.channel) {
            await ctx.reply("This command can only be used in a server channel.");
            return;
        }

        const amount = ctx.parseInteger("amount", 0);

        if (!amount || isNaN(amount) || amount < 1 || amount > 100) {
            await ctx.reply("Please provide a valid number between 1 and 100.");
            return;
        }

        const channel = ctx.channel as TextChannel | NewsChannel | ThreadChannel;

        if (!("bulkDelete" in channel)) {
            await ctx.reply("I cannot bulk delete messages in this type of channel.");
            return;
        }

        try {
            if (ctx instanceof CommandContext) {
                await ctx.defer(true); // Defer ephemerally so the bot message isn't deleted or cluttering
            }

            // In typical prefix bot fashion, we delete `amount + 1` to include the user's command if possible.
            const deleteCount = ctx instanceof MessageContext ? Math.min(amount + 1, 100) : amount;

            const deleted = await channel.bulkDelete(deleteCount, true);

            if (ctx instanceof CommandContext) {
                try {
                    await ctx.editReply(`Successfully deleted ${deleted.size} message(s).`, { ephemeral: true });
                } catch (e: any) {
                    // 10008 Unknown Message is a known API race condition when editing immediately after bulkDelete interacts with the channel.
                    if (e.code === 10008) {
                        try {
                            await ctx.command.followUp({ content: `Successfully deleted ${deleted.size} message(s).`, ephemeral: true });
                        } catch (_) { }
                    } else {
                        throw e;
                    }
                }
            } else {
                const msg = await channel.send(`Successfully deleted ${deleted.size - 1} message(s).`);
                setTimeout(() => {
                    msg.delete().catch(() => null);
                }, 3000);
            }
        } catch (error: any) {
            console.error("Clear Command Error:", error);
            if (ctx instanceof CommandContext) {
                // If it's a 10008, the invocation context is corrupted/deleted; we attempt a followUp
                if (error?.code === 10008) {
                    await ctx.command.followUp({ content: "An error occurred. Messages older than 14 days cannot be bulk deleted.", ephemeral: true }).catch(() => null);
                } else {
                    try {
                        await ctx.editReply("An error occurred. Messages older than 14 days cannot be bulk deleted.");
                    } catch (err: any) {
                        if (err?.code === 10008) {
                           await ctx.command.followUp({ content: "An error occurred. Messages older than 14 days cannot be bulk deleted.", ephemeral: true }).catch(() => null); 
                        }
                    }
                }
            } else {
                await ctx.reply("An error occurred. Messages older than 14 days cannot be bulk deleted.").catch(() => null);
            }
        }
    }
};

export default clear;
