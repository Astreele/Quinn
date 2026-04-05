import { Command } from "../../types";
import { EmbedBuilder } from "discord.js";

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
    const embed = new EmbedBuilder()
      .setColor("Yellow")
      .setTitle("Bot Ping")
      .addFields({
        name: "⚡ Latency",
        value: "Pinging...",
      })
      // .setDescription(`Latency: Pinging...`)
      .setThumbnail(ctx.client.user!.displayAvatarURL())
      .setFooter({ text: `Requested by ${ctx.author.username}` })
      .setTimestamp();

    const sent = await ctx.reply({ embeds: [embed] });

    const latency = sent.createdTimestamp - ctx.createdTimestamp;

    embed.data.fields[0].value = `${latency}ms`;
    await ctx.editReply({ embeds: [embed] });
  },
};

export default ping;
