import { Command } from "../../types";
import { loadCommands, registerCommands } from "../../handlers/commands";
import { EmbedBuilder } from "discord.js";

const reload: Command = {
  name: "reload",
  description: "Reloads all bot commands.",
  category: "admin",

  async execute(ctx) {
    const embed = new EmbedBuilder()
      .setFooter({ text: `Requested by ${ctx.author.username}` })
      .setTimestamp()
      .setColor("Yellow");

    embed.setDescription("Reloading commands...");
    await ctx.reply({ embeds: [embed] });

    try {
      const client = ctx.client;
      await loadCommands(client);
      await registerCommands(client);
      embed.setDescription("Successfully reloaded all commands.");
      await ctx.editReply({ embeds: [embed] });
    } catch (error) {
      embed.setDescription("Failed to reload commands.");
      await ctx.editReply({ embeds: [embed] });
    }
  },
};

export default reload;
