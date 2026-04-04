import fs from "fs/promises";
import path from "path";
import { ExtendedClient } from "../client";
import { Command } from "../types";
import { logger } from "../utils/logger";
import { REST, Routes } from "discord.js";

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
                f =>
                    (f.endsWith(".ts") || f.endsWith(".js")) &&
                    !f.endsWith(".d.ts")
            )) {
                const filePath = path.join(fullPath, file);
                delete require.cache[require.resolve(filePath)];
                const cmdModule = await require(path.join(filePath));
                const cmd: Command = cmdModule.default;

                if (!cmd || !cmd.name) {
                    logger.warn(
                        `The command at ${file} is missing a required "name" or "execute" property.`
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

    if (!process.env.DISCORD_TOKEN) return;

    const rest = new REST({ version: "10" }).setToken(
        process.env.DISCORD_TOKEN
    );

    try {
        logger.info("Started refreshing application (/) commands...");

        const slashCommandsData = client.commands.map(cmd => ({
            name: cmd.name,
            description: cmd.description,
            options: cmd.options || []
        }));

        if (useTestGuild && testGuildId) {
            logger.debug(`Pushing commands to test server: ${testGuildId}...`);
            await rest.put(
                Routes.applicationGuildCommands(clientID, testGuildId),
                { body: slashCommandsData }
            );
            logger.info("Successfully reloaded local guild (/) commands.");
        } else {
            logger.debug("Pushing commands globally...");
            await rest.put(Routes.applicationCommands(clientID), {
                body: slashCommandsData
            });
            logger.info("Successfully reloaded global (/) commands.");
        }
    } catch (error) {
        logger.error("Failed to register slash commands:", error);
    }
}
