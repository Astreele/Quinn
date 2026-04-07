import { EmbedBuilder } from "discord.js";
import { Command } from "../../types";

const coinflip: Command = {
  name: "coinflip",
  description: "Flips a coin.",
  async execute(ctx) {
    const outcomes = ["Heads", "Tails"] as const;
    const result = outcomes[Math.floor(Math.random() * outcomes.length)];

    const embed = new EmbedBuilder()
      .setColor("Yellow")
      .setTitle("Coin Flip 🪙")
      .setDescription(`The coin landed on **${result}**.`)
      .setFooter({ text: `Flipped by ${ctx.author.username}` })
      .setTimestamp();

    await ctx.reply({ embeds: [embed] });
  },
};

export default coinflip;
