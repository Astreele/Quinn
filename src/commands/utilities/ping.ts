import { Command } from "../../types";
import { createInfoEmbed } from "../../utils/embedBuilder";

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
    const embed = createInfoEmbed(ctx, "Bot Ping", "Pinging...").setThumbnail(
      ctx.client.user!.displayAvatarURL()
    );

    const sent = await ctx.reply({ embeds: [embed] });

    const latency = sent.createdTimestamp - ctx.createdTimestamp;

    embed.setFields({
      name: "⚡ Latency",
      value: `${latency}ms`,
    });
    await ctx.editReply({ embeds: [embed] });
  },
};

export default ping;
