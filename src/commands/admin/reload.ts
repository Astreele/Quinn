import { Command } from "../../types";
import { loadCommands, registerCommands } from "../../handlers/commands";
import { EmbedBuilder } from "discord.js";

function createEmbed(requestedBy: string) {
  return new EmbedBuilder()
    .setFooter({ text: `Requested by ${requestedBy}` })
    .setTimestamp()
    .setColor("Yellow");
}

async function runReload(
  ctx: Parameters<NonNullable<Command["subcommands"]>[number]["execute"]>[0],
  register: boolean
) {
  const embed = createEmbed(ctx.author.username);

  embed.setDescription(
    register
      ? "Reloading command files and registering slash commands..."
      : "Reloading command files..."
  );
  await ctx.reply({ embeds: [embed] });

  try {
    await loadCommands(ctx.client);

    if (register) {
      await registerCommands(ctx.client);
    }

    embed.setDescription(
      register
        ? "Successfully reloaded command files and registered slash commands."
        : "Successfully reloaded command files."
    );
    await ctx.editReply({ embeds: [embed] });
  } catch {
    embed.setDescription(
      register
        ? "Failed to reload command files and register slash commands."
        : "Failed to reload command files."
    );
    await ctx.editReply({ embeds: [embed] });
  }
}

const reload: Command = {
  name: "reload",
  description: "Reload bot command files and slash registrations.",
  category: "admin",
  defaultSubcommand: "files",
  subcommands: [
    {
      name: "files",
      description: "Reloads command files.",

      async execute(ctx) {
        await runReload(ctx, false);
      },
    },
    {
      name: "register",
      description: "Reloads command files and registers slash commands.",

      async execute(ctx) {
        await runReload(ctx, true);
      },
    },
  ],
};

export default reload;
