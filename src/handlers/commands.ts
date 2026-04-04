import fs from "fs/promises";
import path from "path";
import { ExtendedClient } from "../client";
import { Command } from "../types";
import { logger } from "../utils/logger";

export async function loadCommands(client: ExtendedClient) {
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
            for (const file of files.filter(f => (f.endsWith(".ts") || f.endsWith(".js")) && !f.endsWith(".d.ts"))) {
                const cmdModule = await import(path.join(fullPath, file));
                const cmd: Command = cmdModule.default;
                
                if (!cmd || !cmd.name) {
                    logger.warn(`The command at ${file} is missing a required "name" or "execute" property.`);
                    continue;
                }
                cmd.category = folder.toUpperCase();
                client.commands.set(cmd.name, cmd);
            }
        }
    }
    logger.info(`Loaded ${client.commands.size} commands.`);
}
