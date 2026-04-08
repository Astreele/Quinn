import fs from "fs/promises";
import path from "path";
import { ExtendedClient } from "../client";
import { Command } from "../types";
import { logger } from "../utils/logger";
import { ApplicationCommandOptionType, REST, Routes } from "discord.js";

function buildSlashCommandData(cmd: Command) {
  return {
    name: cmd.name,
    description: cmd.description,
    options: cmd.subcommands?.length
      ? cmd.subcommands.map((subcommand) => ({
          name: subcommand.name,
          description: subcommand.description,
          type: ApplicationCommandOptionType.Subcommand,
          options: subcommand.options || [],
        }))
      : cmd.options || [],
  };
}

export async function loadCommands(client: ExtendedClient) {
  client.commands.clear();
  const foldersPath = path.join(__dirname, "..", "commands");
  try {
    await fs.access(foldersPath);
  } catch {
    logger.warn("No commands folder found.");
    return;
  }

  const folders = await fs.readdir(foldersPath);
  for (const folder of folders) {
    const fullPath = path.join(foldersPath, folder);
    const stat = await fs.stat(fullPath);
    if (stat.isDirectory()) {
      const files = await fs.readdir(fullPath);
      for (const file of files.filter(
        (f) => (f.endsWith(".ts") || f.endsWith(".js")) && !f.endsWith(".d.ts")
      )) {
        const filePath = path.join(fullPath, file);
        delete require.cache[require.resolve(filePath)];
        const cmdModule = require(filePath);
        const cmd: Command = cmdModule.default;
        const isRunnable = Boolean(cmd?.execute || cmd?.subcommands?.length);

        if (!cmd || !cmd.name || !isRunnable) {
          logger.warn(
            `The command at ${file} must define a name and either execute() or at least one subcommand.`
          );
          continue;
        }
        cmd.category = folder.toUpperCase();
        client.commands.set(cmd.name, cmd);
      }
    }
  }
  logger.info(`Loaded ${client.commands.size} commands.`);
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
