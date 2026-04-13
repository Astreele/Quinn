import { eq, and, gt, isNull, lte, asc } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema";
import { logger } from "../utils/logger";
import * as userService from "./userService";

export interface CooldownResult {
  /** true = command is blocked, false = allowed */
  blocked: boolean;
  /** Seconds until user can use again (only set when blocked). */
  remainingSeconds: number | null;
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
  guildId?: string
): Promise<CooldownResult> {
  const user = await userService.upsertUser(db, userDiscordId, username);
  if (!user) {
    // If user can't be upserted, don't block — let them through
    return { blocked: false, remainingSeconds: null };
  }

  const now = new Date();
  const guildCondition = guildId
    ? eq(schema.cooldowns.guildId, guildId)
    : isNull(schema.cooldowns.guildId);

  // Step 1: Clean up expired entries for this user+command
  await db
    .delete(schema.cooldowns)
    .where(
      and(
        eq(schema.cooldowns.userId, user.id),
        eq(schema.cooldowns.commandName, commandName),
        lte(schema.cooldowns.expiresAt, now),
        guildCondition
      )
    );

  // Step 2: Count remaining active cooldowns (ordered oldest first)
  const activeCooldowns = await db
    .select({ expiresAt: schema.cooldowns.expiresAt })
    .from(schema.cooldowns)
    .where(
      and(
        eq(schema.cooldowns.userId, user.id),
        eq(schema.cooldowns.commandName, commandName),
        gt(schema.cooldowns.expiresAt, now),
        guildCondition
      )
    )
    .orderBy(asc(schema.cooldowns.expiresAt));

  // Step 3: Check if limit is exceeded
  if (activeCooldowns.length >= maxUses) {
    const oldestExpires = activeCooldowns[0].expiresAt;
    const remainingMs = oldestExpires.getTime() - now.getTime();
    const remainingSeconds = remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 1;

    return { blocked: true, remainingSeconds };
  }

  // Step 4: Under limit — record this use and allow
  const expiresAt = new Date(now.getTime() + cooldownSeconds * 1000);
  await db.insert(schema.cooldowns).values({
    userId: user.id,
    commandName,
    guildId: guildId || null,
    expiresAt,
  });

  return { blocked: false, remainingSeconds: null };
}

/**
 * Global cleanup of all expired cooldowns across all users/commands.
 * Useful as a periodic cron job to prevent table bloat.
 */
export async function cleanExpiredCooldowns(db: NodePgDatabase<typeof schema>) {
  const result = await db
    .delete(schema.cooldowns)
    .where(lte(schema.cooldowns.expiresAt, new Date()));

  logger.info(`Cleaned up expired cooldowns (removed ${result.rowCount ?? 0} rows)`);
  return result;
}
