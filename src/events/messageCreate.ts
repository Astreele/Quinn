import { Message } from "discord.js";
import { ExtendedClient } from "../client";
import { BotEvent } from "../types";
import { executeWithValidation } from "../utils/validation";
import { MessageContext } from "../context";
import { resolveMessageCommand } from "../utils/commandResolver";

const event: BotEvent<"messageCreate"> = {
  name: "messageCreate",
  execute: async (client: ExtendedClient, message: Message) => {
    if (message.author.bot) return;
    const prefix = process.env.PREFIX || "$"; // example prefix
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();
    if (!commandName) return;

    const resolved = resolveMessageCommand(client, commandName, args);
    if (!resolved) return;

    if (resolved.command.conf?.allowPrefix === false) return;

    const ctx = new MessageContext(
      message,
      resolved.args,
      resolved.rootCommand.name,
      resolved.subcommandPath
    );
    await executeWithValidation(client, resolved.command, ctx);
  },
};

export default event;
