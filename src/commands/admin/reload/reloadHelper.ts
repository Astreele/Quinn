import { Command } from "../../../types";
import { loadCommands, registerCommands } from "../../../handlers/commands";
import { createInfoEmbed, createErrorEmbed } from "../../../utils/embedBuilder";

/**
 * Shared reload logic used by all reload subcommands.
 */
export async function runReload(
  ctx: Parameters<NonNullable<Command["execute"]>>[0],
  register: boolean
) {
  const embed = createInfoEmbed(
    ctx,
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
    const errorEmbed = createErrorEmbed(
      ctx,
      "Reload Failed",
      register
        ? "Failed to reload command files and register slash commands."
        : "Failed to reload command files."
    );
    await ctx.editReply({ embeds: [errorEmbed] });
  }
}
