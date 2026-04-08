import { Interaction } from "discord.js";
import { ExtendedClient } from "../client";
import { BotEvent } from "../types";
import { executeWithValidation } from "../utils/validation";
import { CommandContext } from "../context";
import { resolveInteractionCommand } from "../utils/commandResolver";
import { logger } from "../utils/logger";

const event: BotEvent<"interactionCreate"> = {
  name: "interactionCreate",
  execute: async (client: ExtendedClient, interaction: Interaction) => {
    // if the interaction is not a chat input command, return
    if (!interaction.isChatInputCommand()) return;

    const resolved = resolveInteractionCommand(client, interaction);
    if (!resolved) {
      logger.warn(
        `Received unknown slash command '${interaction.commandName}'. This usually means Discord still has stale registered commands.`
      );
      await interaction.reply({
        content:
          "That slash command is stale or unknown to the current bot build. Re-register commands and try again.",
        ephemeral: true,
      });
      return;
    }

    const ctx = new CommandContext(
      interaction,
      resolved.args,
      resolved.rootCommand.name,
      resolved.subcommandName
    );
    await executeWithValidation(client, resolved.command, ctx);
  },
};

export default event;
