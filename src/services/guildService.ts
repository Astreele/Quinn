import { eq } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema";
import { logger } from "../utils/logger";

type Guild = typeof schema.guilds.$inferSelect;

/**
 * Get an existing guild by Discord ID.
 * Returns null if guild doesn't exist - use when guild MUST already exist.
 */
export async function getGuild(
  db: NodePgDatabase<typeof schema>,
  discordId: string
): Promise<Guild | null> {
  try {
    return (
      (await db.query.guilds.findFirst({
        where: eq(schema.guilds.discordId, discordId),
      })) ?? null
    );
  } catch (error) {
    logger.error("Failed to get guild:", error);
    throw error;
  }
}

/**
 * Create or update a guild with full Discord data synchronization.
 * Use this whenever you need to ensure guild exists with latest Discord info.
 */
export async function upsertGuild(
  db: NodePgDatabase<typeof schema>,
  discordId: string,
  name: string,
  prefix?: string
): Promise<Guild | null> {
  try {
    const [guild] = await db
      .insert(schema.guilds)
      .values({
        discordId,
        name,
        prefix: prefix || "$",
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.guilds.discordId,
        set: {
          name,
          prefix: prefix || schema.guilds.prefix,
          updatedAt: new Date(),
        },
      })
      .returning();

    logger.debug(`Guild upserted: ${discordId}`);
    return guild ?? null;
  } catch (error) {
    logger.error("Failed to upsert guild:", error);
    throw error;
  }
}
