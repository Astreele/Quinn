import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  serial,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const actionTypeEnum = pgEnum("action_type", [
  "warn",
  "kick",
  "ban",
  "unban",
  "timeout",
  "untimeout",
  "mute",
  "unmute",
  "lock",
  "unlock",
  "clear",
]);

// Users table - tracks Discord users
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  discordId: varchar("discord_id", { length: 32 }).notNull().unique(),
  username: varchar("username", { length: 64 }).notNull(),
  discriminator: varchar("discriminator", { length: 8 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const usersRelations = relations(users, ({ many }) => ({
  warningsAsTarget: many(warnings, { relationName: "warnedUser" }),
  warningsAsModerator: many(warnings, { relationName: "moderator" }),
  cooldowns: many(cooldowns),
}));

// Guilds table - tracks Discord guilds/servers
export const guilds = pgTable("guilds", {
  id: uuid("id").primaryKey().defaultRandom(),
  discordId: varchar("discord_id", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  prefix: varchar("prefix", { length: 4 }).default("$").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Warnings table - moderation warnings
export const warnings = pgTable("warnings", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  moderatorId: uuid("moderator_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  reason: text("reason").notNull(),
  guildId: varchar("guild_id", { length: 32 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const warningsRelations = relations(warnings, ({ one }) => ({
  user: one(users, {
    fields: [warnings.userId],
    references: [users.id],
    relationName: "warnedUser",
  }),
  moderator: one(users, {
    fields: [warnings.moderatorId],
    references: [users.id],
    relationName: "moderator",
  }),
}));

// Cooldowns table - command cooldown tracking
export const cooldowns = pgTable("cooldowns", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  commandName: varchar("command_name", { length: 64 }).notNull(),
  guildId: varchar("guild_id", { length: 32 }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cooldownsRelations = relations(cooldowns, ({ one }) => ({
  user: one(users, {
    fields: [cooldowns.userId],
    references: [users.id],
  }),
}));

// Audit logs table - moderation action logging
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  guildId: varchar("guild_id", { length: 32 }).notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  action: actionTypeEnum("action").notNull(),
  targetId: varchar("target_id", { length: 32 }),
  reason: text("reason"),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

// Indexes (created via migrations)
export const indexes = {
  usersDiscordIdIdx: "users_discord_id_idx",
  guildsDiscordIdIdx: "guilds_discord_id_idx",
  warningsUserIdIdx: "warnings_user_id_idx",
  warningsGuildIdIdx: "warnings_guild_id_idx",
  cooldownsUserIdCommandIdx: "cooldowns_user_id_command_idx",
  cooldownsExpiresAtIdx: "cooldowns_expires_at_idx",
  auditLogsGuildIdIdx: "audit_logs_guild_id_idx",
  auditLogsUserIdIdx: "audit_logs_user_id_idx",
  auditLogsCreatedAtIdx: "audit_logs_created_at_idx",
};
