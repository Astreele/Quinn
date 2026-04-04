import { Command } from "../../types";

/**
 * A simple utility command that checks the bot's current response latency.
 * Provides a working example of using the universal Context object.
 */
const ping: Command = {
    name: "ping",
    description: "Check bot latency",
    category: "utility",

    /**
     * Executes the ping command, measuring the round-trip time.
     * @param ctx The abstraction containing the user's message/interaction.
     */
    async execute(ctx) {
        const sent = await ctx.reply("Pinging...");

        const latency = sent.createdTimestamp - ctx.createdTimestamp;

        await ctx.editReply(`Latency: ${latency}ms`);
    }
};

export default ping;
