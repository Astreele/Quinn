import { eq, isNull, isNotNull, and } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema";
import { logger } from "../utils/logger";

type User = typeof schema.users.$inferSelect;

/**
 * Get an existing user by Discord ID.
 * Excludes soft-deleted users.
 * @returns null if user doesn't exist or is soft-deleted.
 */
export async function getUser(
  db: NodePgDatabase<typeof schema>,
  discordId: string
): Promise<User | null> {
  try {
    return (
      (await db.query.users.findFirst({
        where: and(
          eq(schema.users.discordId, discordId),
          isNull(schema.users.deletedAt)
        ),
      })) ?? null
    );
  } catch (error) {
    logger.error("Failed to get user:", error);
    throw error;
  }
}

/**
 * Get a user including soft-deleted ones.
 * Use only when you need to check deletion status.
 */
export async function getUserIncludingDeleted(
  db: NodePgDatabase<typeof schema>,
  discordId: string
): Promise<User | null> {
  try {
    return (
      (await db.query.users.findFirst({
        where: eq(schema.users.discordId, discordId),
      })) ?? null
    );
  } catch (error) {
    logger.error("Failed to get user (including deleted):", error);
    throw error;
  }
}

/**
 * Soft-delete a user. Sets deletedAt instead of removing the record.
 * This preserves all FK relationships (warnings, audit logs, cooldowns).
 *
 * @returns true if the user was marked as deleted, false if already deleted or not found.
 */
export async function softDeleteUser(
  db: NodePgDatabase<typeof schema>,
  discordId: string
): Promise<boolean> {
  try {
    const result = await db
      .update(schema.users)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(schema.users.discordId, discordId),
          isNull(schema.users.deletedAt)
        )
      );

    const wasDeleted = (result.rowCount ?? 0) > 0;
    if (wasDeleted) {
      logger.info(`User soft-deleted: ${discordId}`);
    } else {
      logger.warn(`User not found or already soft-deleted: ${discordId}`);
    }
    return wasDeleted;
  } catch (error) {
    logger.error("Failed to soft-delete user:", error);
    throw error;
  }
}

/**
 * Restore a soft-deleted user.
 *
 * @returns true if restored, false if user was not soft-deleted or not found.
 */
export async function restoreUser(
  db: NodePgDatabase<typeof schema>,
  discordId: string
): Promise<boolean> {
  try {
    const result = await db
      .update(schema.users)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(
        and(
          eq(schema.users.discordId, discordId),
          isNotNull(schema.users.deletedAt)
        )
      );

    const wasRestored = (result.rowCount ?? 0) > 0;
    if (wasRestored) {
      logger.info(`User restored: ${discordId}`);
    }
    return wasRestored;
  } catch (error) {
    logger.error("Failed to restore user:", error);
    throw error;
  }
}

/**
 * Create or update a user with full Discord data synchronization.
 * Reactivates the user if they were soft-deleted.
 * Use this whenever you need to ensure user exists with latest Discord info.
 */
export async function upsertUser(
  db: NodePgDatabase<typeof schema>,
  discordId: string,
  username: string,
  discriminator?: string
): Promise<User | null> {
  try {
    const [user] = await db
      .insert(schema.users)
      .values({
        discordId,
        username,
        discriminator,
        deletedAt: null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.users.discordId,
        set: {
          username,
          discriminator,
          deletedAt: null, // reactivate if soft-deleted
          updatedAt: new Date(),
        },
      })
      .returning();

    logger.debug(`User upserted: ${discordId}`);
    return user ?? null;
  } catch (error) {
    logger.error("Failed to upsert user:", error);
    throw error;
  }
}
