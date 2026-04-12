import { GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
import { ExtendedClient } from "./client";
import { loadCommands } from "./handlers/commands";
import { loadEvents } from "./handlers/events";
import { database } from "../db_integration/database";
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
    GatewayIntentBits.MessageContent,
  ],
});

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  try {
    await database.disconnect();
    client.destroy();
    logger.info("Shutdown complete");
    process.exit(0);
  } catch (error) {
    logger.error("Error during shutdown:", error);
    process.exit(1);
  }
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

// Main initialization wrapper
async function main() {
  try {
    // Connect to database if configured
    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl) {
      const db = await database.connect(databaseUrl);
      client.setDatabase(db);
      logger.info("Database integration enabled");
    } else {
      logger.warn("DATABASE_URL not set - running without database");
    }

    // Load commands and events
    await loadEvents(client);
    await loadCommands(client);
    // await registerCommands(client);
    // Login to Discord
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    logger.error("Failed to start the bot:", error);
    await database.disconnect().catch(() => {});
    process.exit(1);
  }
}

main();
