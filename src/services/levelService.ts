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
  firstMessageAt: number;
  lastMessageAt: number;
}

const levelCache = new Map<string, LevelEntry>();
let watchdogInterval: NodeJS.Timeout | null = null;

const TEN_MINUTES_MS = 10 * 60 * 1000;
const WATCHDOG_TICK_MS = 60 * 1000;

function getCacheKey(userId: string, guildId: string) {
  return `${userId}:${guildId}`;
}

// Standard XP formula (Level = 0.1 * sqrt(XP))
function calculateLevelFromXp(exp: number): number {
  return Math.floor(0.1 * Math.sqrt(exp));
}

async function loadUserToCache(
  db: NodePgDatabase<typeof schema>,
  userId: string,
  guildId: string
): Promise<LevelEntry> {
  const key = getCacheKey(userId, guildId);
  const now = Date.now();
  try {
    const [dbRecord] = await db
      .select()
      .from(schema.userLevels)
      .where(
        sql`${schema.userLevels.userId} = ${userId} AND ${schema.userLevels.guildId} = ${guildId}`
      );

    const entry: LevelEntry = {
      userId,
      guildId,
      level: dbRecord?.level ?? 0,
      exp: dbRecord?.exp ?? 0,
      isDirty: false,
      firstMessageAt: now,
      lastMessageAt: now,
    };
    levelCache.set(key, entry);
    return entry;
  } catch (error) {
    logger.error(`Failed to load level for user ${userId}:`, error);
    const fallback: LevelEntry = {
      userId,
      guildId,
      level: 0,
      exp: 0,
      isDirty: false,
      firstMessageAt: now,
      lastMessageAt: now,
    };
    levelCache.set(key, fallback);
    return fallback;
  }
}

async function syncUserToDb(
  db: NodePgDatabase<typeof schema>,
  entry: LevelEntry
): Promise<void> {
  if (!entry.isDirty) return;
  try {
    await db
      .insert(schema.userLevels)
      .values({
        userId: entry.userId,
        guildId: entry.guildId,
        level: entry.level,
        exp: entry.exp,
      })
      .onConflictDoUpdate({
        target: [schema.userLevels.userId, schema.userLevels.guildId],
        set: {
          level: sql`EXCLUDED.level`,
          exp: sql`EXCLUDED.exp`,
        },
      });
    entry.isDirty = false;
  } catch (error) {
    logger.error(`Failed to sync level for user ${entry.userId}:`, error);
  }
}

export function startWatchdog(db: NodePgDatabase<typeof schema>) {
  if (watchdogInterval) return;

  watchdogInterval = setInterval(async () => {
    const now = Date.now();

    for (const [key, entry] of levelCache.entries()) {
      // Rule 1: Clean up cache after 10 minutes of complete silence
      if (now - entry.lastMessageAt >= TEN_MINUTES_MS) {
        await syncUserToDb(db, entry);
        levelCache.delete(key);
        logger.info(`Evicted idle user ${entry.userId} from memory cache.`);
        continue;
      }

      // Rule 2: Force periodic save 10 minutes after their initial text
      if (now - entry.firstMessageAt >= TEN_MINUTES_MS) {
        if (entry.isDirty) {
          await syncUserToDb(db, entry);
          logger.info(
            `Throttled database sync processed for active user ${entry.userId}`
          );
        }
        entry.firstMessageAt = now; // Reset window tracker for the next 10 minutes
      }
    }
  }, WATCHDOG_TICK_MS);
}

export function stopWatchdog() {
  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
  }
}

export async function addXp(
  db: NodePgDatabase<typeof schema>,
  userId: string,
  guildId: string,
  amount: number
): Promise<XpResult> {
  const key = getCacheKey(userId, guildId);
  const now = Date.now();

  // 1. Core State Retrieval
  const entry =
    levelCache.get(key) ?? (await loadUserToCache(db, userId, guildId));

  // 2. Refresh activity tracking timestamps
  entry.lastMessageAt = now;
  entry.exp += amount;
  entry.isDirty = true;

  // 3. Compute level calculations
  const newLevel = calculateLevelFromXp(entry.exp);
  const leveledUp = newLevel > entry.level;

  if (leveledUp) {
    entry.level = newLevel;
  }

  return { leveledUp, level: entry.level };
}

export async function flushAllCaches(
  db: NodePgDatabase<typeof schema>
): Promise<void> {
  logger.info(
    "Gracefully flushing all remaining memory cache before shutdown..."
  );
  stopWatchdog();
  for (const entry of levelCache.values()) {
    await syncUserToDb(db, entry);
  }
  levelCache.clear();
}
