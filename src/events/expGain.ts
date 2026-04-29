import { Message } from "discord.js";
import { BotEvent } from "../types";
import { ExtendedClient } from "../client";
import { logger } from "../utils/logger";
import * as cooldownService from "../services/cooldownService";
import { addXp } from "../services/levelService";

const event: BotEvent<"messageCreate"> = {
    name: "messageCreate",
    execute: async (client: ExtendedClient, message: Message) => {
        if (message.author.bot) return;
        if (!message.inGuild()) return;

        if (client.db) {
            const cooldownKey = "expGain";
            const cooldownSeconds = 60;
            const maxUses = 1;
            const userId = message.author.id;
            const userName = message.author.username;
            const guildId = message.guildId;
            const guildName = message.guild.name

            try {
                const result = await cooldownService.checkAndRecordCooldown(
                    client.db,
                    userId,
                    userName,
                    cooldownKey,
                    cooldownSeconds,
                    maxUses,
                    guildId,
                    guildName
                );

                if (result.blocked) return;

                const resultXp = await addXp(client.db, userId, guildId, 50);

                if (!resultXp.leveledUp) return;

                await message.channel.send(
                    `🎉 <@${userId}> leveled up to level ${resultXp.level}!`
                );
            } catch (error) {
                logger.error("Database cooldown check failed:", error);
            }
        }
    }
};

export default event;
