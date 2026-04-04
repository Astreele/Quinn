import { GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
import { ExtendedClient } from "./client";
import { loadCommands } from "./handlers/commands";
import { loadEvents } from "./handlers/events";
import { logger } from "./utils/logger";

// Load environment variables
dotenv.config();

// Validate required environment variables
if (!process.env.DISCORD_TOKEN) {
    logger.error("Missing DISCORD_TOKEN in .env file");
    process.exit(1);
}

// Initialize the Discord client with required intents
const client = new ExtendedClient({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Main initialization wrapper
async function main() {
    try {
        // Load commands and events
        await loadCommands(client);
        await loadEvents(client);

        // Login to Discord
        await client.login(process.env.DISCORD_TOKEN);
    } catch (error) {
        logger.error("Failed to start the bot:", error);
        process.exit(1);
    }
}

main();
