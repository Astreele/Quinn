import { gt, lte } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema";
import { logger } from "../utils/logger";
import * as userService from "./userService";
import * as guildService from "./guildService";

const PERSISTENCE_THRESHOLD_SECONDS = 60 * 60 * 60;

let CleanUpInterval: NodeJS.Timeout | null = null;

const CLEAN_UP_TICK_MS = 60 * 1000;

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
  cooldowns: {
    expiresAt: number;
    isPersistent: boolean;
  }[];
}

const cooldownCache = new Map<string, CacheEntry>();

const MAX_CACHE_ENTRIES = 20000;
const MAX_EXPIRES_ARRAY_LENGTH = 1000;

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

    // Clean up expired ones from DB first to catch anything missed during downtime
    const deleteResult = await db
      .delete(schema.cooldowns)
      .where(lte(schema.cooldowns.expiresAt, now));

    if ((deleteResult.rowCount ?? 0) > 0) {
      logger.info(
        `Cleaned up ${deleteResult.rowCount} expired cooldowns from database.`
      );
    }

    // Fetch active ones
    const activeCooldowns = await db
      .select()
      .from(schema.cooldowns)
      .where(gt(schema.cooldowns.expiresAt, now));

    for (const cd of activeCooldowns) {
      const key = getCacheKey(cd.userId, cd.commandName, cd.guildId);
      let existing = cooldownCache.get(key);

      if (existing) {
        existing.cooldowns.push({
          expiresAt: cd.expiresAt.getTime(),
          isPersistent: true, // Loaded from DB, so it is inherently persistent
        });
        if (existing.cooldowns.length > MAX_EXPIRES_ARRAY_LENGTH) {
          existing.cooldowns = existing.cooldowns.slice(
            -MAX_EXPIRES_ARRAY_LENGTH
          );
        }
      } else {
        if (cooldownCache.size >= MAX_CACHE_ENTRIES) {
          const firstKey = cooldownCache.keys().next().value;
          if (firstKey) cooldownCache.delete(firstKey);
        }
        cooldownCache.set(key, {
          userId: cd.userId,
          username: "",
          guildId: cd.guildId,
          guildName: "",
          commandName: cd.commandName,
          cooldowns: [
            {
              expiresAt: cd.expiresAt.getTime(),
              isPersistent: true,
            },
          ],
        });
      }
    }

    // Ensure times are ordered correctly inside memory windows
    for (const entry of cooldownCache.values()) {
      entry.cooldowns.sort((a, b) => a.expiresAt - b.expiresAt);
    }

    logger.info(
      `Loaded ${activeCooldowns.length} long-term active cooldowns into memory.`
    );
  } catch (error) {
    logger.error("Failed to load cooldowns:", error);
  }
}

export async function saveCooldowns(db: NodePgDatabase<typeof schema>) {
  try {
    stopCleanUp();
    const now = Date.now();
    const toInsert: (typeof schema.cooldowns.$inferInsert)[] = [];

    // Gather active timestamps that were tagged as persistent
    for (const entry of cooldownCache.values()) {
      const validLongTerms = entry.cooldowns.filter(
        (c) => c.isPersistent && c.expiresAt > now
      );

      for (const item of validLongTerms) {
        toInsert.push({
          userId: entry.userId,
          commandName: entry.commandName,
          guildId: entry.guildId || null,
          expiresAt: new Date(item.expiresAt),
        });
      }
    }

    // Step A: Clear expired rows from DB to avoid table swelling
    await db
      .delete(schema.cooldowns)
      .where(lte(schema.cooldowns.expiresAt, new Date(now)));

    // Step B: Batch save/update active records safely
    if (toInsert.length > 0) {
      const chunkSize = 1000;
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        await db
          .insert(schema.cooldowns)
          .values(toInsert.slice(i, i + chunkSize))
          .onConflictDoNothing();
      }
    }

    logger.info(`Synced ${toInsert.length} long-term cooldowns to database.`);
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
  const now = Date.now();
  const key = getCacheKey(userDiscordId, commandName, guildId);

  let entry = cooldownCache.get(key);

  if (entry) {
    // Evict expired timestamps from this user's running window
    entry.cooldowns = entry.cooldowns.filter((c) => c.expiresAt > now);
    if (entry.cooldowns.length > MAX_EXPIRES_ARRAY_LENGTH) {
      entry.cooldowns = entry.cooldowns.slice(-MAX_EXPIRES_ARRAY_LENGTH);
    }
  } else {
    // Allocate space if entry is new
    if (cooldownCache.size >= MAX_CACHE_ENTRIES) {
      const firstKey = cooldownCache.keys().next().value;
      if (firstKey) cooldownCache.delete(firstKey);
    }
    entry = {
      userId: userDiscordId,
      username,
      guildId: guildId || null,
      guildName: guildName || null,
      commandName,
      cooldowns: [],
    };
    cooldownCache.set(key, entry);
  }

  // Evaluate sliding window capacity boundary
  if (entry.cooldowns.length >= maxUses) {
    const oldest = entry.cooldowns[0].expiresAt;
    const remainingMs = oldest - now;
    const remainingSeconds =
      remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 1;

    return { blocked: true, remainingSeconds };
  }

  // Determine whether this item needs database protection
  const isPersistent = cooldownSeconds >= PERSISTENCE_THRESHOLD_SECONDS;

  // Add current tracking block to array
  entry.cooldowns.push({
    expiresAt: now + cooldownSeconds * 1000,
    isPersistent,
  });
  entry.cooldowns.sort((a, b) => a.expiresAt - b.expiresAt);

  entry.username = username;
  if (guildId && guildName) {
    entry.guildId = guildId;
    entry.guildName = guildName;
  }

  // LAZY WRITES: Only resolve DB tables asynchronously if this is a persistent execution
  // Fire-and-forget safely in background to not block the current Discord interaction thread
  if (isPersistent) {
    (async () => {
      try {
        const user = await userService.upsertUser(db, userDiscordId, username);
        if (user && guildId && guildName) {
          await guildService.upsertGuild(db, guildId, guildName);
        }
      } catch (err) {
        logger.error(
          "Background error during persistent user/guild sync:",
          err
        );
      }
    })();
  }

  return { blocked: false, remainingSeconds: null };
}

/**
 * Global cleanup of all expired cooldowns across all users/commands.
 * Useful as a periodic cron job to prevent table bloat.
 */
export function cleanUp(db: NodePgDatabase<typeof schema>) {
  if (CleanUpInterval) return;

  CleanUpInterval = setInterval(async () => {
    try {
      const now = Date.now();
      let memoryRemoved = 0;

      // 1. Clean up memory cache
      for (const [key, entry] of cooldownCache.entries()) {
        entry.cooldowns = entry.cooldowns.filter((c) => c.expiresAt > now);
        if (entry.cooldowns.length === 0) {
          cooldownCache.delete(key);
          memoryRemoved++;
        }
      }

      // 2. Clear expired rows from Database
      const result = await db
        .delete(schema.cooldowns)
        .where(lte(schema.cooldowns.expiresAt, new Date(now)));

      if (memoryRemoved > 0 || (result.rowCount ?? 0) > 0) {
        logger.info(
          `Garbage Collector watchdog tick completed. (Flushed ${memoryRemoved} empty cache keys, ${result.rowCount ?? 0} rows cleared from DB).`
        );
      }
    } catch (error) {
      logger.error("Failed to run global garbage collection loop:", error);
    }
  }, CLEAN_UP_TICK_MS);
}

export function stopCleanUp() {
  if (CleanUpInterval) {
    clearInterval(CleanUpInterval);
    CleanUpInterval = null;
  }
}
