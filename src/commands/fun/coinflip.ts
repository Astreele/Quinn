import { Command } from "../../types";
import { createInfoEmbed } from "../../utils/embedBuilder";

const coinflip: Command = {
  name: "coinflip",
  description: "Flips a coin.",
  async execute(ctx) {
    const outcomes = ["Heads", "Tails"] as const;
    const result = outcomes[Math.floor(Math.random() * outcomes.length)];

    const embed = createInfoEmbed(
      ctx,
      "Coin Flip 🪙",
      `The coin landed on **${result}**.`
    );

    await ctx.reply({ embeds: [embed] });
  },
};

export default coinflip;
