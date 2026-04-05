import { Command } from "../../types";
import { loadCommands, registerCommands } from "../../handlers/commands";

const reload: Command = {
  name: "reload",
  description: "Reloads all bot commands.",
  category: "admin",

  async execute(ctx) {
    await ctx.reply("Reloading commands...");

    try {
      const client = ctx.client;
      await loadCommands(client);
      await registerCommands(client);
      await ctx.editReply("Successfully reloaded all commands.");
    } catch (error) {
      await ctx.editReply("Failed to reload commands.");
    }
  },
};

export default reload;
