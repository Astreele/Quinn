import { Interaction } from "discord.js";
import { ExtendedClient } from "../client";
import { BotEvent } from "../types";
import { executeWithValidation } from "../utils/validation";
import { CommandContext } from "../context";

const event: BotEvent<"interactionCreate"> = {
    name: "interactionCreate",
    execute: async (client: ExtendedClient, interaction: Interaction) => {
        // if the interaction is not a chat input command, return
        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        const ctx = new CommandContext(interaction, []);
        await executeWithValidation(client, command, ctx);
    }
};

export default event;
