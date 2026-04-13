import { eq, and, asc, sql } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema";
import { logger } from "../utils/logger";
import * as userService from "./userService";
import type { PaginationOptions } from "./types";

export interface WarningData {
  userDiscordId: string;
  username: string;
  discriminator?: string;
  moderatorDiscordId: string;
  moderatorUsername: string;
  moderatorDiscriminator?: string;
  reason: string;
  guildId: string;
}

export interface AddWarningOptions {
  /** Create an audit log entry alongside the warning. Default: true */
  createAudit?: boolean;
  /** Override the audit details. Defaults to the warning reason. */
  auditDetails?: string;
  /** Override the audit action type. Defaults to "warn". */
  auditAction?: (typeof schema.actionTypeEnum.enumValues)[number];
}

export class UserNotFoundError extends Error {
  constructor(userDiscordId: string) {
    super(`User not found: ${userDiscordId}`);
    this.name = "UserNotFoundError";
  }
}

export class WarningNotFoundError extends Error {
  constructor(warningId: number, userDiscordId: string) {
    super(`Warning ${warningId} not found for user ${userDiscordId}`);
    this.name = "WarningNotFoundError";
  }
}

/**
 * Internal helper to create an audit log entry.
 * Used by both addWarning (inline) and logAudit (standalone).
 * Must be called within a transaction.
 */
async function _insertAuditLog(
  tx: NodePgDatabase<typeof schema>,
  data: {
    guildId: string;
    userUuid: string;
    action: (typeof schema.actionTypeEnum.enumValues)[number];
    targetId?: string;
    reason?: string;
    details?: string;
  }
) {
  await tx.insert(schema.auditLogs).values({
    guildId: data.guildId,
    userId: data.userUuid,
    action: data.action,
    targetId: data.targetId,
    reason: data.reason,
    details: data.details,
  });
}

/**
 * Add a warning to a user.
 * Will create or update both the target user and the moderator to ensure
 * they exist in the database for referential integrity.
 *
 * By default, also creates an audit log entry within the same transaction.
 * Set `options.createAudit = false` to disable audit logging.
 *
 * @returns The created warning record.
 * @throws If the database operation fails.
 */
export async function addWarning(
  db: NodePgDatabase<typeof schema>,
  data: WarningData,
  options: AddWarningOptions = {}
) {
  const { createAudit = true, auditDetails, auditAction = "warn" } = options;

  return await db.transaction(async (tx) => {
    // Upsert target user to ensure they exist
    const targetUser = await userService.upsertUser(
      tx,
      data.userDiscordId,
      data.username,
      data.discriminator
    );

    if (!targetUser) {
      throw new Error(`Failed to upsert target user: ${data.userDiscordId}`);
    }

    // Upsert moderator to ensure they exist for FK guarantee
    const moderatorUser = await userService.upsertUser(
      tx,
      data.moderatorDiscordId,
      data.moderatorUsername,
      data.moderatorDiscriminator
    );

    if (!moderatorUser) {
      throw new Error(`Failed to upsert moderator: ${data.moderatorDiscordId}`);
    }

    const [warning] = await tx
      .insert(schema.warnings)
      .values({
        userId: targetUser.id,
        moderatorId: moderatorUser.id,
        reason: data.reason,
        guildId: data.guildId,
      })
      .returning();

    if (!warning) {
      throw new Error(`Failed to create warning for ${data.userDiscordId}`);
    }

    // Create audit log in the same transaction (opt-out)
    if (createAudit) {
      await _insertAuditLog(tx, {
        guildId: data.guildId,
        userUuid: moderatorUser.id,
        action: auditAction,
        targetId: data.userDiscordId,
        reason: data.reason,
        details: auditDetails,
      });
    }

    logger.info(
      `Warning added for user ${data.userDiscordId} by moderator ${data.moderatorDiscordId}`
    );
    return warning;
  });
}

/**
 * Delete a specific warning by ID.
 *
 * @throws UserNotFoundError if the user does not exist
 * @throws WarningNotFoundError if the warning was not found or doesn't belong to the user
 */
export async function deleteWarning(
  db: NodePgDatabase<typeof schema>,
  userDiscordId: string,
  warningId: number
) {
  const user = await userService.getUser(db, userDiscordId);
  if (!user) {
    throw new UserNotFoundError(userDiscordId);
  }

  const [deletedWarning] = await db
    .delete(schema.warnings)
    .where(
      and(
        eq(schema.warnings.id, warningId),
        eq(schema.warnings.userId, user.id)
      )
    )
    .returning();

  if (!deletedWarning) {
    throw new WarningNotFoundError(warningId, userDiscordId);
  }

  logger.info(`Warning ${warningId} deleted for user ${userDiscordId}`);
  return deletedWarning;
}

/**
 * Get warnings for a user.
 *
 * @returns
 * - `null` if the user does not exist in the database
 * - `[]` if the user exists but has no warnings
 * - Array of warning records with user and moderator relations included
 */
export async function getUserWarnings(
  db: NodePgDatabase<typeof schema>,
  userDiscordId: string,
  guildId?: string,
  pagination?: PaginationOptions
) {
  try {
    const user = await userService.getUser(db, userDiscordId);
    if (!user) return null; // user doesn't exist

    return await db.query.warnings.findMany({
      where: guildId
        ? and(
            eq(schema.warnings.userId, user.id),
            eq(schema.warnings.guildId, guildId)
          )
        : eq(schema.warnings.userId, user.id),
      orderBy: [asc(schema.warnings.createdAt), asc(schema.warnings.id)],
      limit: pagination?.limit,
      offset: pagination?.offset,
      with: {
        user: true,
        moderator: true,
      },
    });
  } catch (error) {
    logger.error("Failed to get user warnings:", error);
    throw error;
  }
}

/**
 * Get the total warning count for a user.
 * Uses raw SQL COUNT for efficiency — does not load rows into memory.
 *
 * @returns
 * - `null` if the user does not exist
 * - Number of warnings otherwise
 */
export async function getWarningCount(
  db: NodePgDatabase<typeof schema>,
  userDiscordId: string,
  guildId?: string
): Promise<number | null> {
  try {
    const user = await userService.getUser(db, userDiscordId);
    if (!user) return null;

    const whereClause = guildId
      ? and(
          eq(schema.warnings.userId, user.id),
          eq(schema.warnings.guildId, guildId)
        )
      : eq(schema.warnings.userId, user.id);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.warnings)
      .where(whereClause);

    return Number(count);
  } catch (error) {
    logger.error("Failed to get warning count:", error);
    throw error;
  }
}
