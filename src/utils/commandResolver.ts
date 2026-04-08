import { ChatInputCommandInteraction } from "discord.js";
import { ExtendedClient } from "../client";
import { Command, Subcommand } from "../types";

interface ResolvedCommand {
  rootCommand: Command;
  command: Command | Subcommand;
  args: string[];
  subcommandName: string | null;
}

export function resolveMessageCommand(
  client: ExtendedClient,
  commandName: string,
  args: string[]
): ResolvedCommand | null {
  const rootCommand = client.commands.get(commandName);
  if (!rootCommand) return null;

  const requestedSubcommand = args[0]?.toLowerCase();
  const explicitSubcommand = requestedSubcommand
    ? rootCommand.subcommands?.find((entry) => entry.name === requestedSubcommand)
    : undefined;

  if (explicitSubcommand) {
    return {
      rootCommand,
      command: explicitSubcommand,
      args: args.slice(1),
      subcommandName: explicitSubcommand.name,
    };
  }

  const defaultSubcommand = rootCommand.defaultSubcommand
    ? rootCommand.subcommands?.find(
        (entry) => entry.name === rootCommand.defaultSubcommand
      )
    : undefined;

  if (defaultSubcommand) {
    return {
      rootCommand,
      command: defaultSubcommand,
      args,
      subcommandName: defaultSubcommand.name,
    };
  }

  return {
    rootCommand,
    command: rootCommand,
    args,
    subcommandName: null,
  };
}

export function resolveInteractionCommand(
  client: ExtendedClient,
  interaction: ChatInputCommandInteraction
): ResolvedCommand | null {
  const rootCommand = client.commands.get(interaction.commandName);
  if (!rootCommand) return null;

  const subcommandName = interaction.options.getSubcommand(false);
  const subcommand = subcommandName
    ? rootCommand.subcommands?.find((entry) => entry.name === subcommandName)
    : undefined;

  if (subcommand) {
    return {
      rootCommand,
      command: subcommand,
      args: [],
      subcommandName: subcommand.name,
    };
  }

  return {
    rootCommand,
    command: rootCommand,
    args: [],
    subcommandName: null,
  };
}
