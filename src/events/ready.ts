import { REST, Routes, Client } from "discord.js";
import { ExtendedClient } from "../client";
import { BotEvent } from "../types";
import { logger } from "../utils/logger";

const event: BotEvent<"clientReady"> = {
    name: "clientReady",
    once: true,
    execute: async (client: ExtendedClient, readyClient: Client<true>) => {
        logger.info(`Quinn is online! Logged in as ${readyClient.user?.tag}`);
        logger.info(`Serving ${client.guilds.cache.size} guild(s)`);
        
        if (!process.env.DISCORD_TOKEN) return;

        const rest = new REST({ version: "10" }).setToken(
            process.env.DISCORD_TOKEN
        );
        const testGuildId = process.env.TEST_GUILD_ID;
        const useTestGuild = process.env.USE_TEST_GUILD === "true";
        
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
                    Routes.applicationGuildCommands(
                        client.user!.id,
                        testGuildId
                    ),
                    { body: slashCommandsData }
                );
                logger.info("Successfully reloaded local guild (/) commands.");
            } else {
                logger.debug("Pushing commands globally...");
                await rest.put(Routes.applicationCommands(client.user!.id), {
                    body: slashCommandsData
                });
                logger.info("Successfully reloaded global (/) commands.");
            }
        } catch (error) {
            logger.error("Failed to register slash commands:", error);
        }
    }
};

export default event;
