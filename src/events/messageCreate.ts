import { Message } from "discord.js";
import { ExtendedClient } from "../client";
import { BotEvent } from "../types";
import { executeWithValidation } from "../utils/validation";
import { MessageContext } from "../context";

const event: BotEvent<"messageCreate"> = {
    name: "messageCreate",
    execute: async (client: ExtendedClient, message: Message) => {
        if (message.author.bot) return;
        const prefix = "N.";// example prefix
        if (!message.content.startsWith(prefix)) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift()?.toLowerCase();
        if (!commandName) return;

        const command = client.commands.get(commandName);
        if (!command) return;
        
        if (command.conf?.allowPrefix === false) return;

        const ctx = new MessageContext(message, args);
        await executeWithValidation(client, command, ctx);
    }
};

export default event;
