import { ChatInputCommandInteraction } from "discord.js";
import { ExtendedClient } from "../client";
import { Command } from "../types";

interface ResolvedCommand {
  rootCommand: Command;
  command: Command;
  args: string[];
  /** Full subcommand path for logging/context (e.g., "warnings list" or null) */
  subcommandPath: string | null;
}

/**
 * Resolves a prefix-based message command by traversing the command tree.
 *
 * Discord API Constraints (Enforced at Build Time AND Runtime):
 * - Maximum 2 levels of nesting (same as slash commands)
 * - Level 0: Root command
 * - Level 1: Subcommand OR SubcommandGroup
 * - Level 2: Subcommand inside SubcommandGroup
 * - Cannot mix flat subcommands with subcommand groups
 *
 * Both prefix and slash commands follow the SAME depth limit to ensure:
 * - Consistent behavior across all command invocation methods
 * - Alignment with Discord API constraints
 * - Predictable command structure for users
 *
 * Resolution Algorithm:
 * 1. Get root command from client.commands
 * 2. Traverse _children Map using args sequentially
 * 3. Stop at depth 2 (Discord limit) or when no more matching children
 * 4. Return deepest valid match + remaining args
 *
 * Example 1 (Flat): !moderation ban
 *   - rootCommand: "moderation"
 *   - Traverse: moderation._children.get("ban")
 *   - Result: { command: ban, subcommandPath: "ban" }
 *
 * Example 2 (Grouped): !moderation user ban
 *   - rootCommand: "moderation"
 *   - Traverse: moderation._children.get("user")
 *   - Traverse: user._children.get("ban")
 *   - Result: { command: ban, subcommandPath: "user ban" }
 *
 * @param client - The ExtendedClient instance containing registered commands
 * @param commandName - The root command name (e.g., "moderation")
 * @param args - Remaining arguments after command name
 * @returns ResolvedCommand object or null if not found
 */
export function resolveMessageCommand(
  client: ExtendedClient,
  commandName: string,
  args: string[]
): ResolvedCommand | null {
  // Look up root command by prefixName
  const rootCommand = client.prefixShortcuts.get(commandName);
  if (!rootCommand) return null;

  // If the root command is a group with children, traverse using args
  let current: Command = rootCommand;
  const path: string[] = [];
  let consumedArgs = 0;
  const maxDepth = 2; // Discord API limit

  while (
    current._children &&
    current._children.size > 0 &&
    path.length < maxDepth
  ) {
    const nextName = args[consumedArgs]?.toLowerCase();
    if (!nextName) break; // No more args to traverse with

    // Try to find child by name or prefixName
    let next: Command | undefined;
    for (const child of current._children.values()) {
      if (child.name === nextName || child.prefixName === nextName) {
        next = child;
        break;
      }
    }
    if (!next) break; // Child not found

    current = next;
    path.push(next.prefixName || next.name);
    consumedArgs++;
  }

  // If we traversed into children, the remaining args are after the consumed ones
  const remainingArgs = args.slice(consumedArgs);

  return {
    rootCommand,
    command: current,
    args: remainingArgs,
    subcommandPath: path.length > 0 ? path.join(" ") : null,
  };
}

/**
 * Resolves a slash command interaction by traversing the command tree.
 *
 * Discord API Constraints (Strictly Enforced):
 * - Maximum 2 levels: /command group subcommand
 * - Level 0: Root command
 * - Level 1: Subcommand OR SubcommandGroup
 * - Level 2: Subcommand inside SubcommandGroup
 *
 * Discord provides the structure via interaction.options:
 * - getSubcommandGroup(false) - Returns group name if present, null otherwise
 * - getSubcommand(false) - Returns subcommand name
 *
 * Resolution Algorithm:
 * 1. Get root command from client.commands
 * 2. Check if subcommandGroup exists (depth 1)
 * 3. If yes, get subcommand from group._children (depth 2)
 * 4. If no, get subcommand directly from root._children (depth 1)
 *
 * Example 1 (Flat): /moderation ban
 *   - subcommandGroup: null
 *   - subcommand: "ban"
 *   - Traverse: moderation._children.get("ban")
 *
 * Example 2 (Grouped): /moderation user ban
 *   - subcommandGroup: "user"
 *   - subcommand: "ban"
 *   - Traverse: moderation._children.get("user")._children.get("ban")
 *
 * @param client - The ExtendedClient instance containing registered commands
 * @param interaction - The ChatInputCommandInteraction to resolve
 * @returns ResolvedCommand object or null if not found
 */
export function resolveInteractionCommand(
  client: ExtendedClient,
  interaction: ChatInputCommandInteraction
): ResolvedCommand | null {
  const rootCommand = client.commands.get(interaction.commandName);
  if (!rootCommand) return null;

  // Discord provides subcommand path via options
  const subcommandGroup = interaction.options.getSubcommandGroup(false);
  const subcommandName = interaction.options.getSubcommand(false);

  // No subcommand at all - execute root command
  if (!subcommandGroup && !subcommandName) {
    return {
      rootCommand,
      command: rootCommand,
      args: [],
      subcommandPath: null,
    };
  }

  // Has a subcommand group: /command group subcommand (depth 2)
  if (subcommandGroup) {
    const group = rootCommand._children?.get(subcommandGroup);
    if (!group) return null;

    const subcommand = group._children?.get(subcommandName!);
    if (!subcommand) return null;

    return {
      rootCommand,
      command: subcommand,
      args: [],
      subcommandPath: `${subcommandGroup} ${subcommandName}`,
    };
  }

  // Has only a subcommand (no group): /command subcommand (depth 1)
  if (subcommandName) {
    const subcommand = rootCommand._children?.get(subcommandName);
    if (!subcommand) return null;

    return {
      rootCommand,
      command: subcommand,
      args: [],
      subcommandPath: subcommandName,
    };
  }

  return null;
}
