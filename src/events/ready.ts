import { Client } from "discord.js";
import { ExtendedClient } from "../client";
import { BotEvent } from "../types";
import { logger } from "../utils/logger";

const event: BotEvent<"clientReady"> = {
  name: "clientReady",
  once: true,
  execute: (client: ExtendedClient, readyClient: Client<true>) => {
    logger.info(`Quinn is online! Logged in as ${readyClient.user?.tag}`);
    logger.info(`Serving ${client.guilds.cache.size} guild(s)`);
  },
};

export default event;
