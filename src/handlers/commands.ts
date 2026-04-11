import fs from "fs/promises";
import path from "path";
import { ExtendedClient } from "../client";
import { Command } from "../types";
import { logger } from "../utils/logger";
import {
  ApplicationCommandOptionType,
  REST,
  Routes,
  APIApplicationCommandSubcommandOption,
  APIApplicationCommandSubcommandGroupOption,
} from "discord.js";

/**
 * Validates that a command group's structure complies with Discord API constraints.
 * Throws with detailed error message if violations are found.
 *
 * @param commandName - The name of the parent command for error messages
 * @param files - Array of file entries (will become flat subcommands)
 * @param folders - Array of folder entries (will become subcommand groups)
 * @param depth - Current nesting level (0 = root, flat commands and groups can coexist)
 */
function validateCommandStructure(
  commandName: string,
  files: Array<{ name: string; hasCommandExport: boolean }>,
  folders: string[],
  depth: number
): void {
  // Only count actual command files (not helpers/utilities)
  const hasFiles = files.some((f) => f.hasCommandExport);
  const hasFolders = folders.length > 0;

  // RULE 1: Cannot mix files and folders at the same level (depth > 0 only)
  // At depth 0 (root/top-level commands), flat commands and groups CAN coexist
  // because each top-level entry is its own independent Discord application command.
  // The "no mixing" rule applies to subcommands WITHIN a single command.
  if (depth > 0 && hasFiles && hasFolders) {
    const commandFiles = files
      .filter((f) => f.hasCommandExport)
      .map((f) => f.name);
    throw new Error(
      `Command structure violation: "${commandName}" mixes flat subcommands with subcommand groups.\n` +
        `Discord API requires commands to be EITHER all flat subcommands OR all subcommand groups.\n\n` +
        `Files found: ${commandFiles.join(", ")}\n` +
        `Folders found: ${folders.join(", ")}\n\n` +
        `To fix this:\n` +
        `  Move all files into a subfolder to create a grouped structure:\n` +
        `    ${commandName}/general/file1.ts, ${commandName}/general/file2.ts, etc.`
    );
  }

  // RULE 2: Maximum depth of 2 levels (Discord API limit)
  // depth 0 = top-level command (e.g., "moderation")
  // depth 1 = subcommand or group (e.g., "moderation ban" or "moderation user/")
  // depth 2 = subcommand inside group (e.g., "moderation user ban")
  if (depth > 2) {
    throw new Error(
      `Command structure violation: "${commandName}" exceeds maximum nesting depth.\n` +
        `Discord API supports maximum 2 levels: /command group subcommand\n\n` +
        `Current depth: ${depth} levels\n` +
        `To fix this: Flatten the structure to max 2 levels:\n` +
        `  ❌ /command group subgroup subcommand (3 levels)\n` +
        `  ✅ /command group subcommand (2 levels)`
    );
  }

  // RULE 3: Groups at depth 2 cannot have children (would be depth 3)
  if (depth === 2 && hasFolders) {
    throw new Error(
      `Command structure violation: Subcommand at depth 2 cannot have nested groups.\n` +
        `Command: "${commandName}" at depth ${depth}\n` +
        `Found folders: ${folders.join(", ")}\n\n` +
        `Discord API limit: /command group subcommand (max 2 levels)\n` +
        `To fix this: Move these folders up one level or flatten the structure.`
    );
  }
}

/**
 * Recursively scans a directory and builds the command tree.
 * Files become commands, folders become command groups.
 * _default.ts (or _index.ts) becomes the group's execute function.
 *
 * Enforces Discord API constraints at build time:
 * - Maximum 2 levels of nesting (within a group, not at root)
 * - Cannot mix flat subcommands with subcommand groups (within a group)
 * - Fails fast with detailed error messages on violations
 *
 * @param dirPath - Directory path to scan
 * @param category - Category name (top-level folder name, for logging only)
 * @param depth - Current nesting level (0 = category root, transparent)
 * @param parentName - Parent command name for error messages
 * @returns Map of command name to Command object
 */
async function buildCommandTree(
  dirPath: string,
  category: string,
  depth = 0,
  parentName = ""
): Promise<Map<string, Command>> {
  const children = new Map<string, Command>();
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  // Separate files and folders
  const fileEntries = entries.filter((e) => e.isFile());
  const folderEntries = entries.filter((e) => e.isDirectory());

  // Quick scan to identify which files are actual commands vs helpers
  const filesWithExportInfo = fileEntries.map((f) => {
    let hasCommandExport = false;

    // Only check files that look like TypeScript/JavaScript files
    if (f.name.match(/\.(ts|js)$/) && !f.name.endsWith(".d.ts")) {
      try {
        const filePath = path.join(dirPath, f.name);
        delete require.cache[require.resolve(filePath)];
        const cmdModule = require(filePath);
        const cmd: Command = cmdModule.default;
        hasCommandExport = Boolean(cmd && cmd.name);
      } catch {
        // If we can't load it, assume it's not a command
        hasCommandExport = false;
      }
    }

    return {
      name: f.name,
      hasCommandExport,
    };
  });
  const folders = folderEntries.map((f) => f.name);

  // Use folder name or parent name for validation errors
  const commandName = parentName || path.basename(dirPath) || category;

  // VALIDATE: Check Discord API constraints BEFORE building
  validateCommandStructure(commandName, filesWithExportInfo, folders, depth);

  // Process files (commands)
  for (const file of fileEntries) {
    if (!file.name.match(/\.(ts|js)$/) || file.name.endsWith(".d.ts")) continue;

    const filePath = path.join(dirPath, file.name);

    // Clear require cache for hot reload
    delete require.cache[require.resolve(filePath)];
    const cmdModule = require(filePath);
    const cmd: Command = cmdModule.default;

    // Skip helper/utility files that don't export a command
    if (!cmd || !cmd.name) {
      logger.debug(`Skipping non-command file: ${file.name}`);
      continue;
    }

    if (!cmd.execute) {
      logger.warn(
        `The command at ${file.name} must define an execute() function.`
      );
      continue;
    }

    // Set category only at depth 0 (top-level categories)
    if (depth === 0) {
      cmd.category = category.toUpperCase();
    }

    // Set prefixName from name if not provided
    if (!cmd.prefixName) {
      cmd.prefixName = cmd.name;
    }

    children.set(cmd.name, cmd);
  }

  // Process folders (command groups)
  for (const folder of folderEntries) {
    const folderPath = path.join(dirPath, folder.name);

    // Recursively build sub-tree (validation happens inside recursive call)
    const subChildren = await buildCommandTree(
      folderPath,
      category,
      depth + 1,
      `${commandName}/${folder.name}`
    );

    // Create a group command
    const groupCommand: Command = {
      name: folder.name,
      prefixName: folder.name,
      description: `Command group for ${folder.name}`,
      _isGroup: true,
      _children: subChildren,
    };

    children.set(folder.name, groupCommand);
  }

  return children;
}

/**
 * Builds slash command options for a command from its validated command tree.
 *
 * Since command trees are validated before building, this function can safely
 * assume the structure is valid:
 * - Either ALL children are flat subcommands (depth 1)
 * - Or ALL children are subcommand groups (depth 2)
 * - No mixing within a group (caught at build time)
 *
 * @param cmd - The validated Command object with optional children
 * @returns Array of Discord API-compatible option objects
 */
function buildSlashCommandOptions(
  cmd: Command
): Array<
  | APIApplicationCommandSubcommandOption
  | APIApplicationCommandSubcommandGroupOption
> {
  const options: Array<
    | APIApplicationCommandSubcommandOption
    | APIApplicationCommandSubcommandGroupOption
  > = [];

  // No children - return regular options if any
  if (!cmd._children || cmd._children.size === 0) {
    return (cmd.options || []) as any[];
  }

  // Check structure type (guaranteed to be consistent due to validation)
  const hasGroups = Array.from(cmd._children.values()).some(
    (child) => child._isGroup
  );

  if (!hasGroups) {
    // CASE 1: All flat subcommands (depth 1)
    // Example: /moderation ban, /moderation kick
    for (const [name, child] of cmd._children) {
      options.push({
        name,
        description: child.description,
        type: ApplicationCommandOptionType.Subcommand,
        options: (child.options || []) as any[],
      });
    }
  } else {
    // CASE 2: All subcommand groups (depth 2)
    // Example: /moderation user ban, /moderation warnings list
    for (const [groupName, group] of cmd._children) {
      // Skip non-groups (shouldn't exist due to validation, but safety check)
      if (!group._isGroup || !group._children) continue;

      const subcommands: Array<{
        name: string;
        description: string;
        type: ApplicationCommandOptionType.Subcommand;
        options: any[];
      }> = [];

      for (const [subName, sub] of group._children) {
        // Skip deeper nesting (Discord limit already enforced by validation)
        if (sub._isGroup) continue;
        subcommands.push({
          name: subName,
          description: sub.description,
          type: ApplicationCommandOptionType.Subcommand,
          options: (sub.options || []) as any[],
        });
      }

      options.push({
        name: groupName,
        description: group.description,
        type: ApplicationCommandOptionType.SubcommandGroup,
        options: subcommands,
      });
    }
  }

  return options;
}

function buildSlashCommandData(cmd: Command) {
  return {
    name: cmd.name,
    description: cmd.description,
    options: buildSlashCommandOptions(cmd),
  };
}

/**
 * Scans a single directory and returns files/folders without building the tree.
 * Used by loadCommands to aggregate across category folders before validation.
 */
async function scanDirectory(dirPath: string): Promise<{
  commandFiles: Array<{ name: string; filePath: string; cmd: Command }>;
  folders: string[];
}> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const commandFiles: Array<{ name: string; filePath: string; cmd: Command }> =
    [];
  const folders: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      folders.push(entry.name);
    } else if (
      entry.isFile() &&
      entry.name.match(/\.(ts|js)$/) &&
      !entry.name.endsWith(".d.ts")
    ) {
      const filePath = path.join(dirPath, entry.name);
      try {
        delete require.cache[require.resolve(filePath)];
        const cmdModule = require(filePath);
        const cmd: Command = cmdModule.default;
        if (cmd && cmd.name) {
          commandFiles.push({ name: cmd.name, filePath, cmd });
        }
      } catch {
        // Skip non-command files
      }
    }
  }

  return { commandFiles, folders };
}

/**
 * Loads all commands from the commands directory using recursive file-based resolution.
 * Category folders (admin/, moderation/, fun/, utilities/) are transparent organizational
 * containers — they are NOT part of the command structure.
 *
 * All commands from all categories are merged into one flat namespace:
 *   commands/moderation/ban.ts             → /ban
 *   commands/moderation/channel/lock.ts    → /channel lock
 *   commands/utilities/bot/ping.ts         → /bot ping
 *
 * Validates Discord API constraints on the MERGED result across all categories.
 */
export async function loadCommands(client: ExtendedClient) {
  client.commands.clear();
  client.prefixShortcuts.clear();
  const commandsPath = path.join(__dirname, "..", "commands");

  try {
    await fs.access(commandsPath);
  } catch {
    logger.warn("No commands folder found.");
    return;
  }

  const categoryFolders = await fs.readdir(commandsPath);

  // === PHASE 1: Aggregate all depth-0 entries across all categories ===
  const allCommandFiles: Array<{
    name: string;
    filePath: string;
    cmd: Command;
  }> = [];
  const allFolders = new Set<string>();
  // Map: folderName → list of categories that contain it (for cross-category merging)
  const folderCategoryMap = new Map<string, string[]>();

  for (const category of categoryFolders) {
    const categoryPath = path.join(commandsPath, category);
    const stat = await fs.stat(categoryPath);
    if (!stat.isDirectory()) continue;

    const { commandFiles, folders } = await scanDirectory(categoryPath);
    allCommandFiles.push(...commandFiles);

    for (const folder of folders) {
      if (!allFolders.has(folder)) {
        allFolders.add(folder);
        folderCategoryMap.set(folder, []);
      }
      folderCategoryMap.get(folder)!.push(category);
    }
  }

  // === PHASE 2: Validate the merged depth-0 structure ===
  const filesWithExportInfo = allCommandFiles.map((f) => ({
    name: f.name,
    hasCommandExport: true,
  }));
  validateCommandStructure(
    "root",
    filesWithExportInfo,
    Array.from(allFolders),
    0
  );

  // === PHASE 3: Build the merged command tree ===
  const mergedTree = new Map<string, Command>();

  // Register flat commands (must still be unique across all categories)
  for (const { name, cmd } of allCommandFiles) {
    if (mergedTree.has(name)) {
      throw new Error(
        `Duplicate command name "${name}" found across category folders.\n` +
          `Command names must be unique regardless of category.`
      );
    }
    cmd.category = cmd.category || "GENERAL";
    // Set prefixName from command name if not provided
    if (!cmd.prefixName) {
      cmd.prefixName = cmd.name;
    }
    mergedTree.set(name, cmd);
  }

  // Build subcommand groups, merging across categories when the same group name exists in multiple
  for (const folder of allFolders) {
    const subChildren = new Map<string, Command>();
    const categories = folderCategoryMap.get(folder)!;

    // Aggregate sub-children from ALL categories that contain this group
    for (const category of categories) {
      const categoryPath = path.join(commandsPath, category);
      const folderPath = path.join(categoryPath, folder);

      // Recursively build sub-tree (depth 1 inside the group)
      const groupTree = await buildCommandTree(folderPath, category, 1, folder);
      for (const [name, cmd] of groupTree) {
        if (subChildren.has(name)) {
          throw new Error(
            `Duplicate subcommand name "${name}" in group "${folder}" found in category "${category}".\n` +
              `Subcommand already exists in the same group from another category.\n` +
              `Subcommand names must be unique across all categories within a group.`
          );
        }
        subChildren.set(name, cmd);
      }
    }

    // Check for conflicts with flat commands
    if (mergedTree.has(folder)) {
      throw new Error(
        `Command name "${folder}" conflicts with a subcommand group of the same name.`
      );
    }

    const groupCommand: Command = {
      name: folder,
      prefixName: folder,
      description: `Command group for ${folder}`,
      _isGroup: true,
      _children: subChildren,
    };
    mergedTree.set(folder, groupCommand);
  }

  // Register all merged commands
  for (const [name, cmd] of mergedTree) {
    client.commands.set(name, cmd);
  }

  // Register all commands (including subcommands) by prefixName for prefix resolution
  const registerPrefixShortcuts = (tree: Map<string, Command>) => {
    for (const cmd of tree.values()) {
      client.prefixShortcuts.set(cmd.prefixName!, cmd);
      if (cmd._children) {
        registerPrefixShortcuts(cmd._children);
      }
    }
  };
  registerPrefixShortcuts(mergedTree);

  logger.info(`Loaded ${mergedTree.size} top-level commands/groups.`);
}

export async function registerCommands(client: ExtendedClient) {
  const testGuildId = process.env.TEST_GUILD_ID;
  const useTestGuild = process.env.USE_TEST_GUILD === "true";
  const clientID = process.env.CLIENT_ID;
  const discordToken = process.env.DISCORD_TOKEN;

  if (!discordToken) {
    logger.error("Missing DISCORD_TOKEN in .env. Cannot register commands.");
    return;
  }
  if (!clientID) {
    logger.error("Missing CLIENT_ID in .env. Cannot register commands.");
    return;
  }

  const rest = new REST({ version: "10" }).setToken(discordToken);

  try {
    logger.info("Started refreshing application (/) commands...");

    const slashCommandsData = client.commands.map(buildSlashCommandData);

    if (useTestGuild && testGuildId) {
      logger.debug(`Pushing commands to test server: ${testGuildId}...`);
      await rest.put(Routes.applicationGuildCommands(clientID, testGuildId), {
        body: slashCommandsData,
      });
      logger.debug("Clearing global commands to avoid stale duplicates...");
      await rest.put(Routes.applicationCommands(clientID), {
        body: [],
      });
      logger.info("Successfully reloaded local guild (/) commands.");
    } else {
      logger.debug("Pushing commands globally...");
      await rest.put(Routes.applicationCommands(clientID), {
        body: slashCommandsData,
      });

      if (testGuildId) {
        logger.debug(
          `Clearing test guild commands in ${testGuildId} to avoid stale duplicates...`
        );
        await rest.put(Routes.applicationGuildCommands(clientID, testGuildId), {
          body: [],
        });
      }

      logger.info("Successfully reloaded global (/) commands.");
    }
  } catch (error) {
    logger.error("Failed to register slash commands:", error);
    throw error;
  }
}
