import { sql } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema";
import { logger } from "../utils/logger";

export interface XpResult {
    leveledUp: boolean;
    level: number;
}

interface LevelEntry {
    userId: string;
    guildId: string;
    level: number;
    exp: number;
    isDirty: boolean; // Tracks if this entry needs to be saved to DB
}

const levelCache = new Map<string, LevelEntry>();
let syncInterval: NodeJS.Timeout | null = null;

function getCacheKey(userId: string, guildId: string) {
    return `${userId}:${guildId}`;
}

// Standard XP formula (Level = 0.1 * sqrt(XP))
function calculateLevelFromXp(exp: number): number {
    return Math.floor(0.1 * Math.sqrt(exp));
}

export async function loadLevels(db: NodePgDatabase<typeof schema>) {
    try {
        const allLevels = await db.select().from(schema.userLevels);

        for (const record of allLevels) {
            const key = getCacheKey(record.userId, record.guildId);
            levelCache.set(key, {
                userId: record.userId,
                guildId: record.guildId,
                level: record.level,
                exp: record.exp,
                isDirty: false
            });
        }
        logger.info(`Loaded ${allLevels.length} user levels into memory.`);
    } catch (error) {
        logger.error("Failed to load levels:", error);
    }
}

export async function saveLevels(db: NodePgDatabase<typeof schema>) {
    try {
        // Only grab entries that have changed since the last save
        const dirtyEntries = Array.from(levelCache.values()).filter(
            e => e.isDirty
        );
        if (dirtyEntries.length === 0) return;

        const toInsert = dirtyEntries.map(e => ({
            userId: e.userId,
            guildId: e.guildId,
            level: e.level,
            exp: e.exp
        }));

        const chunkSize = 1000;
        for (let i = 0; i < toInsert.length; i += chunkSize) {
            const chunk = toInsert.slice(i, i + chunkSize);

            await db
                .insert(schema.userLevels)
                .values(chunk)
                .onConflictDoUpdate({
                    target: [
                        schema.userLevels.userId,
                        schema.userLevels.guildId
                    ],
                    set: {
                        level: sql`EXCLUDED.level`,
                        exp: sql`EXCLUDED.experience`
                    }
                });
        }

        // Mark them as clean now that they are saved
        for (const entry of dirtyEntries) {
            entry.isDirty = false;
        }

        logger.info(
            `Synced ${dirtyEntries.length} updated user levels to the database.`
        );
    } catch (error) {
        logger.error("Failed to save levels:", error);
    }
}

export function startLevelSync(db: NodePgDatabase<typeof schema>) {
    if (syncInterval) return;

    // Run every 30 minutes
    syncInterval = setInterval(
        () => {
            saveLevels(db).catch(err =>
                logger.error("Periodic level sync failed", err)
            );
        },
        30 * 60 * 1000
    );
}

export function stopLevelSync() {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }
}

export async function addXp(
    db: NodePgDatabase<typeof schema>,
    userId: string,
    guildId: string,
    amount: number
): Promise<XpResult> {
    const key = getCacheKey(userId, guildId);
    let entry = levelCache.get(key);

    if (!entry) {
        entry = { userId, guildId, level: 0, exp: 0, isDirty: true };
        levelCache.set(key, entry);
    }

    entry.exp += amount;
    entry.isDirty = true; // Flag for the 30-min DB sync

    const newLevel = calculateLevelFromXp(entry.exp);
    const leveledUp = newLevel > entry.level;

    if (leveledUp) {
        entry.level = newLevel;
    }

    return { leveledUp, level: entry.level };
}
