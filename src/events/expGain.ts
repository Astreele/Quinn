import { Message } from "discord.js";
import { BotEvent } from "../types";
import { ExtendedClient } from "../client";
import { logger } from "../utils/logger"
import * as cooldownService from "../services/cooldownService";

const event: BotEvent<"messageCreate"> = {
  name: "messageCreate",
  execute: async (client: ExtendedClient, message: Message) => {
    if (message.author.bot) return;
    if (!message.inGuild()) return;
    
    if (client.db) {
    const cooldownKey = "expGain"
    const cooldownSeconds = 60;
    const maxUses = 1;
    const userId = message.author.id;
    const userName = message.author.username;
    const guildID = message.guildId;

    try {
      const result = await cooldownService.checkAndRecordCooldown(
        client.db,
        userId,
        userName,
        cooldownKey,
        cooldownSeconds,
        maxUses,
        guildID
      );
    } catch (error) {
      logger.error("Database cooldown check failed:", error);
    }
  }
  }
}

export default event;