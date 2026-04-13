import { eq, desc, and } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema";
import { logger } from "../utils/logger";
import * as userService from "./userService";
import type { PaginationOptions } from "./types";

export interface AuditLogData {
  guildId: string;
  userDiscordId: string;
  username: string;
  discriminator?: string;
  action: (typeof schema.actionTypeEnum.enumValues)[number];
  targetId?: string;
  reason?: string;
  details?: string;
}

/**
 * Internal helper to create an audit log entry.
 * Used by addWarning (inline) and logAudit (standalone).
 * Must be called within a transaction if called from within one.
 */
async function _insertAuditLog(
  db: NodePgDatabase<typeof schema>,
  data: {
    guildId: string;
    userUuid: string;
    action: (typeof schema.actionTypeEnum.enumValues)[number];
    targetId?: string;
    reason?: string;
    details?: string;
  }
) {
  const [auditLog] = await db
    .insert(schema.auditLogs)
    .values({
      guildId: data.guildId,
      userId: data.userUuid,
      action: data.action,
      targetId: data.targetId,
      reason: data.reason,
      details: data.details,
    })
    .returning();

  if (!auditLog) {
    throw new Error(`Failed to create audit log for ${data.action}`);
  }

  return auditLog;
}

/**
 * Create an audit log entry for a moderation action.
 * Will upsert the user to ensure the moderator exists for referential integrity.
 *
 * @throws If the database operation fails.
 */
export async function logAudit(
  db: NodePgDatabase<typeof schema>,
  data: AuditLogData
) {
  return await db.transaction(async (tx) => {
    const user = await userService.upsertUser(
      tx,
      data.userDiscordId,
      data.username,
      data.discriminator
    );

    if (!user) {
      throw new Error(
        `Failed to upsert user for audit log: ${data.userDiscordId}`
      );
    }

    const auditLog = await _insertAuditLog(tx, {
      guildId: data.guildId,
      userUuid: user.id,
      action: data.action,
      targetId: data.targetId,
      reason: data.reason,
      details: data.details,
    });

    logger.info(
      `Audit log created: ${data.action} by ${data.userDiscordId} in guild ${data.guildId}`
    );
    return auditLog;
  });
}

/**
 * Get all audit logs for a guild.
 * Returns paginated results ordered by creation date (newest first).
 */
export async function getGuildAuditLogs(
  db: NodePgDatabase<typeof schema>,
  guildId: string,
  pagination?: PaginationOptions
) {
  try {
    return await db.query.auditLogs.findMany({
      where: eq(schema.auditLogs.guildId, guildId),
      orderBy: [
        desc(schema.auditLogs.createdAt),
        desc(schema.auditLogs.id),
      ],
      limit: pagination?.limit,
      offset: pagination?.offset,
    });
  } catch (error) {
    logger.error("Failed to get audit logs:", error);
    throw error;
  }
}

/**
 * Get audit logs for a specific user in a guild.
 * Returns paginated results ordered by creation date (newest first).
 *
 * @param userUuid - Internal user UUID (not Discord ID). Use the `id` field from a user record.
 */
export async function getUserAuditLogs(
  db: NodePgDatabase<typeof schema>,
  guildId: string,
  userUuid: string,
  pagination?: PaginationOptions
) {
  try {
    return await db.query.auditLogs.findMany({
      where: and(
        eq(schema.auditLogs.guildId, guildId),
        eq(schema.auditLogs.userId, userUuid)
      ),
      orderBy: [
        desc(schema.auditLogs.createdAt),
        desc(schema.auditLogs.id),
      ],
      limit: pagination?.limit,
      offset: pagination?.offset,
    });
  } catch (error) {
    logger.error("Failed to get user audit logs:", error);
    throw error;
  }
}

/**
 * Get audit logs filtered by action type.
 * Returns paginated results ordered by creation date (newest first).
 */
export async function getAuditLogsByAction(
  db: NodePgDatabase<typeof schema>,
  guildId: string,
  action: (typeof schema.actionTypeEnum.enumValues)[number],
  pagination?: PaginationOptions
) {
  try {
    return await db.query.auditLogs.findMany({
      where: and(
        eq(schema.auditLogs.guildId, guildId),
        eq(schema.auditLogs.action, action)
      ),
      orderBy: [
        desc(schema.auditLogs.createdAt),
        desc(schema.auditLogs.id),
      ],
      limit: pagination?.limit,
      offset: pagination?.offset,
    });
  } catch (error) {
    logger.error("Failed to get audit logs by action:", error);
    throw error;
  }
}
