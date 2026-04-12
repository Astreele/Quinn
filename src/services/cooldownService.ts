import { eq, and, gt, isNull, lte } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../db_integration/schema";
import { logger } from "../utils/logger";
import * as userService from "./userService";

/**
 * Check if a command is currently on cooldown for a user (user must exist).
 * Fail-safe: returns true (command blocked) if the database is unreachable.
 */
export async function isCommandOnCooldown(
  db: NodePgDatabase<typeof schema>,
  userDiscordId: string,
  commandName: string,
  guildId?: string
): Promise<boolean> {
  try {
    const user = await userService.getUser(db, userDiscordId);
    if (!user) return false; // to not block new users who don't have a record yet, but still block if DB is down 

    const conditions = [
      eq(schema.cooldowns.userId, user.id),
      eq(schema.cooldowns.commandName, commandName),
      gt(schema.cooldowns.expiresAt, new Date()),
    ];

    if (guildId) {
      conditions.push(eq(schema.cooldowns.guildId, guildId));
    } else {
      conditions.push(isNull(schema.cooldowns.guildId));
    }

    const cooldown = await db.query.cooldowns.findFirst({
      where: and(...conditions),
    });

    return !!cooldown;
  } catch (error) {
    logger.error("Failed to check cooldown — blocking command (fail-safe):", error);
    return true; // fail-safe: block command if DB fails
  }
}

/**
 * Set a command cooldown for a user.
 * Will create or update the user if needed to ensure they exist.
 * Caller must provide a valid username for user creation.
 *
 * @throws If the database operation fails.
 */
export async function setCommandCooldown(
  db: NodePgDatabase<typeof schema>,
  userDiscordId: string,
  username: string,
  commandName: string,
  expiresAt: Date,
  guildId?: string
) {
  const user = await userService.upsertUser(db, userDiscordId, username);

  if (!user) {
    throw new Error(`Failed to upsert user for cooldown: ${userDiscordId}`);
  }

  await db.insert(schema.cooldowns).values({
    userId: user.id,
    commandName,
    guildId: guildId || null,
    expiresAt,
  });
}

/**
 * Clean up all expired cooldowns from the database.
 *
 * @throws If the database operation fails.
 */
export async function cleanExpiredCooldowns(db: NodePgDatabase<typeof schema>) {
  const result = await db
    .delete(schema.cooldowns)
    .where(lte(schema.cooldowns.expiresAt, new Date()));

  logger.info("Cleaned up expired cooldowns");
  return result;
}

/**
 * Get remaining cooldown time for a user.
 * Returns null if no active cooldown exists.
 */
export async function getCooldownExpiry(
  db: NodePgDatabase<typeof schema>,
  userDiscordId: string,
  commandName: string,
  guildId?: string
): Promise<Date | null> {
  try {
    const user = await userService.getUser(db, userDiscordId);
    if (!user) return null;

    const conditions = [
      eq(schema.cooldowns.userId, user.id),
      eq(schema.cooldowns.commandName, commandName),
      gt(schema.cooldowns.expiresAt, new Date()),
    ];

    if (guildId) {
      conditions.push(eq(schema.cooldowns.guildId, guildId));
    } else {
      conditions.push(isNull(schema.cooldowns.guildId));
    }

    const cooldown = await db.query.cooldowns.findFirst({
      where: and(...conditions),
      columns: { expiresAt: true },
    });

    return cooldown?.expiresAt ?? null;
  } catch (error) {
    logger.error("Failed to get cooldown expiry:", error);
    return null;
  }
}
