import { eq, isNull, isNotNull, and } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema";
import { logger } from "../utils/logger";

type User = typeof schema.users.$inferSelect;

export async function getUser(
  db: NodePgDatabase<typeof schema>,
  discordId: string
): Promise<User | null> {
  try {
    return (
      (await db.query.users.findFirst({
        where: and(
          eq(schema.users.id, discordId),
          isNull(schema.users.deletedAt)
        ),
      })) ?? null
    );
  } catch (error) {
    logger.error("Failed to get user:", error);
    throw error;
  }
}

export async function getUserIncludingDeleted(
  db: NodePgDatabase<typeof schema>,
  discordId: string
): Promise<User | null> {
  try {
    return (
      (await db.query.users.findFirst({
        where: eq(schema.users.id, discordId),
      })) ?? null
    );
  } catch (error) {
    logger.error("Failed to get user (including deleted):", error);
    throw error;
  }
}

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
          eq(schema.users.id, discordId),
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
          eq(schema.users.id, discordId),
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
        id: discordId,
        username,
        discriminator,
        deletedAt: null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.users.id,
        set: {
          username,
          discriminator,
          deletedAt: null,
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