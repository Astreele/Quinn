import { eq, and, gt, isNull, lte, asc } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema";
import { logger } from "../utils/logger";
import * as userService from "./userService";
import * as guildService from "./guildService";

export interface CooldownResult {
    // true = command is blocked, false = allowed
    blocked: boolean;
    // Seconds until user can use again (only set when blocked).
    remainingSeconds: number | null;
}

interface CacheEntry {
    userId: string;
    username: string;
    guildId: string | null;
    guildName: string | null;
    commandName: string;
    expiresAt: number[];
}

const cooldownCache = new Map<string, CacheEntry>();

function getCacheKey(
    userId: string,
    commandName: string,
    guildId?: string | null
) {
    return `${userId}:${commandName}:${guildId || "global"}`;
}

export async function loadCooldowns(db: NodePgDatabase<typeof schema>) {
    try {
        const now = new Date();

        // 1. Delete any expired cooldowns left over from a previous crash
        const deleteResult = await db
            .delete(schema.cooldowns)
            .where(lte(schema.cooldowns.expiresAt, now));

        if ((deleteResult.rowCount ?? 0) > 0) {
            logger.info(
                `Cleaned up ${deleteResult.rowCount} expired cooldowns from database.`
            );
        }

        // 2. Fetch the remaining valid cooldowns
        const activeCooldowns = await db
            .select()
            .from(schema.cooldowns)
            .where(gt(schema.cooldowns.expiresAt, now));

        for (const cd of activeCooldowns) {
            const key = getCacheKey(cd.userId, cd.commandName, cd.guildId);
            const existing = cooldownCache.get(key);

            if (existing) {
                existing.expiresAt.push(cd.expiresAt.getTime());
                existing.expiresAt.sort((a, b) => a - b);
            } else {
                cooldownCache.set(key, {
                    userId: cd.userId,
                    username: "",
                    guildId: cd.guildId,
                    guildName: "",
                    commandName: cd.commandName,
                    expiresAt: [cd.expiresAt.getTime()]
                });
            }
        }
        logger.info(
            `Loaded ${activeCooldowns.length} active cooldowns into memory.`
        );
    } catch (error) {
        logger.error("Failed to load cooldowns:", error);
    }
}

export async function saveCooldowns(db: NodePgDatabase<typeof schema>) {
    try {
        const now = Date.now();
        const toInsert: (typeof schema.cooldowns.$inferInsert)[] = [];

        for (const [key, entry] of cooldownCache.entries()) {
            const validExpires = entry.expiresAt.filter(t => t > now);
            if (validExpires.length === 0) continue;

            for (const expireTime of validExpires) {
                toInsert.push({
                    userId: entry.userId,
                    commandName: entry.commandName,
                    guildId: entry.guildId || null,
                    expiresAt: new Date(expireTime)
                });
            }
        }

        await db.delete(schema.cooldowns);

        if (toInsert.length > 0) {
            const chunkSize = 1000;
            for (let i = 0; i < toInsert.length; i += chunkSize) {
                await db
                    .insert(schema.cooldowns)
                    .values(toInsert.slice(i, i + chunkSize));
            }
        }

        logger.info(`Saved ${toInsert.length} active cooldowns to database.`);
    } catch (error) {
        logger.error("Failed to save cooldowns:", error);
    }
}

/**
 * Checks if a command is on cooldown and records a use if allowed.
 *
 * Implements a sliding-window rate limiter:
 * 1. Clean up expired cooldown entries for this user+command
 * 2. Count how many uses remain in the window
 * 3. If >= maxUses → blocked (return remaining time until oldest expires)
 * 4. If < maxUses  → allowed (insert a new cooldown row, return not blocked)
 *
 * @param db              Drizzle database instance
 * @param userDiscordId   Discord user ID
 * @param username        Discord username (for user upsert)
 * @param commandName     Full command name (including subcommand if applicable)
 * @param cooldownSeconds Time window in seconds (e.g., 3 for a 3-second window)
 * @param maxUses         Maximum allowed uses within the window
 * @param guildId         Guild ID for guild-scoped cooldowns, or undefined for global
 * @returns CooldownResult indicating if blocked and how long to wait
 */
export async function checkAndRecordCooldown(
    db: NodePgDatabase<typeof schema>,
    userDiscordId: string,
    username: string,
    commandName: string,
    cooldownSeconds: number,
    maxUses: number,
    guildId?: string,
    guildName?: string
): Promise<CooldownResult> {
    const user = await userService.upsertUser(db, userDiscordId, username);
    if (!user) {
        return { blocked: false, remainingSeconds: null };
    }

    if (guildId && guildName) {
        await guildService.upsertGuild(db, guildId, guildName);
    }

    const now = Date.now();
    const key = getCacheKey(user.id, commandName, guildId);

    let entry = cooldownCache.get(key);

    if (entry) {
        entry.expiresAt = entry.expiresAt.filter(t => t > now);
    } else {
        entry = {
            userId: user.id,
            username,
            guildId: guildId || null,
            guildName: guildName || null,
            commandName,
            expiresAt: []
        };
        cooldownCache.set(key, entry);
    }

    if (entry.expiresAt.length >= maxUses) {
        const oldest = entry.expiresAt[0];
        const remainingMs = oldest - now;
        const remainingSeconds =
            remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 1;

        return { blocked: true, remainingSeconds };
    }

    entry.expiresAt.push(now + cooldownSeconds * 1000);
    entry.expiresAt.sort((a, b) => a - b);

    entry.username = username;
    if (guildId && guildName) {
        entry.guildId = guildId;
        entry.guildName = guildName;
    }

    return { blocked: false, remainingSeconds: null };
}

/**
 * Global cleanup of all expired cooldowns across all users/commands.
 * Useful as a periodic cron job to prevent table bloat.
 */
export async function cleanExpiredCooldowns(db: NodePgDatabase<typeof schema>) {
    const now = Date.now();
    let memoryRemoved = 0;

    for (const [key, entry] of cooldownCache.entries()) {
        const valid = entry.expiresAt.filter(t => t > now);
        if (valid.length === 0) {
            cooldownCache.delete(key);
            memoryRemoved++;
        } else {
            entry.expiresAt = valid;
        }
    }

    const result = await db
        .delete(schema.cooldowns)
        .where(lte(schema.cooldowns.expiresAt, new Date(now)));

    logger.info(
        `Cleaned up expired cooldowns (removed ${memoryRemoved} keys from memory, ${result.rowCount ?? 0} rows from DB)`
    );
    return result;
}
