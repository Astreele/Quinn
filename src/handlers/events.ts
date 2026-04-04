import fs from "fs/promises";
import path from "path";
import { ExtendedClient } from "../client";
import { BotEvent } from "../types";
import { logger } from "../utils/logger";

export async function loadEvents(client: ExtendedClient) {
    const eventsPath = path.join(__dirname, "..", "events");
    try {
        await fs.access(eventsPath);
    } catch {
        logger.warn("No events folder found.");
        return;
    }
    
    let eventCount = 0;
    const allFiles = await fs.readdir(eventsPath);
    const eventFiles = allFiles.filter(file => (file.endsWith(".ts") || file.endsWith(".js")) && !file.endsWith(".d.ts"));
    
    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const eventModule = await import(filePath);
        const event: BotEvent = eventModule.default;
        
        if (!event || !event.name || !event.execute) {
            logger.warn(`The event at ${filePath} is missing required properties.`);
            continue;
        }

        if (event.once) {
            client.once(event.name, (...args) => event.execute(client, ...args));
        } else {
            client.on(event.name, (...args) => event.execute(client, ...args));
        }
        eventCount++;
    }
    logger.info(`Loaded ${eventCount} events.`);
}
