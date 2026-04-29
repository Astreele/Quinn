import {
    pgTable,
    varchar,
    text,
    timestamp,
    serial,
    smallint,
    integer,
    pgEnum,
    uniqueIndex,
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
    "clear"
]);

// Users table - 
export const users = pgTable("users", {
    id: varchar("id", { length: 32 }).primaryKey(),
    username: varchar("username", { length: 64 }).notNull(),
    discriminator: varchar("discriminator", { length: 8 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at")
});

export const usersRelations = relations(users, ({ many }) => ({
    warningsAsTarget: many(warnings, { relationName: "warnedUser" }),
    warningsAsModerator: many(warnings, { relationName: "moderator" }),
    cooldowns: many(cooldowns),
    auditLogs: many(auditLogs),
    userLevels: many(userLevels)
}));

// Guilds table - tracks guilds
export const guilds = pgTable("guilds", {
    id: varchar("id", { length: 32 }).primaryKey(),
    name: varchar("name", { length: 128 }).notNull(),
    prefix: varchar("prefix", { length: 4 }).default("$").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const guildsRelations = relations(guilds, ({ many }) => ({
    warnings: many(warnings),
    cooldowns: many(cooldowns),
    auditLogs: many(auditLogs),
    userLevels: many(userLevels)
}));

// Warnings table - moderation warnings
export const warnings = pgTable("warnings", {
    id: serial("id").primaryKey(),
    userId: varchar("user_id", { length: 32 })
        .notNull()
        .references(() => users.id, { onDelete: "restrict" }),
    moderatorId: varchar("moderator_id", { length: 32 })
        .notNull()
        .references(() => users.id, { onDelete: "restrict" }),
    guildId: varchar("guild_id", { length: 32 })
        .notNull()
        .references(() => guilds.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull()
});

export const warningsRelations = relations(warnings, ({ one }) => ({
    user: one(users, {
        fields: [warnings.userId],
        references: [users.id],
        relationName: "warnedUser"
    }),
    moderator: one(users, {
        fields: [warnings.moderatorId],
        references: [users.id],
        relationName: "moderator"
    }),
    guild: one(guilds, {
        fields: [warnings.guildId],
        references: [guilds.id]
    })
}));

// Cooldowns table - command cooldown tracking
export const cooldowns = pgTable(
    "cooldowns",
    {
        id: serial("id").primaryKey(),
        userId: varchar("user_id", { length: 32 })
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        guildId: varchar("guild_id", { length: 32 }).references(
            () => guilds.id,
            { onDelete: "cascade" }
        ),
        commandName: varchar("command_name", { length: 64 }).notNull(),
        expiresAt: timestamp("expires_at").notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull()
    },
    table => ({
        userCommandGuildUnique: uniqueIndex(
            "cooldowns_user_command_guild_unique"
        ).on(table.userId, table.commandName, table.guildId)
    })
);

export const cooldownsRelations = relations(cooldowns, ({ one }) => ({
    user: one(users, {
        fields: [cooldowns.userId],
        references: [users.id]
    }),
    guild: one(guilds, {
        fields: [cooldowns.guildId],
        references: [guilds.id]
    })
}));

// Audit logs table - moderation action logging
export const auditLogs = pgTable("audit_logs", {
    id: serial("id").primaryKey(),
    guildId: varchar("guild_id", { length: 32 })
        .notNull()
        .references(() => guilds.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 32 })
        .notNull()
        .references(() => users.id, { onDelete: "restrict" }),
    action: actionTypeEnum("action").notNull(),
    targetId: varchar("target_id", { length: 32 }),
    reason: text("reason"),
    details: text("details"),
    createdAt: timestamp("created_at").defaultNow().notNull()
});

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
    user: one(users, {
        fields: [auditLogs.userId],
        references: [users.id]
    }),
    guild: one(guilds, {
        fields: [auditLogs.guildId],
        references: [guilds.id]
    })
}));

export const userLevels = pgTable("user_levels", {
  id: serial("id").primaryKey(),
  guildId: varchar("guild_id", { length: 32 })
        .notNull()
        .references(() => guilds.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 32 })
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
  level: smallint("level").default(0).notNull(),
  exp: integer("experience").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
},
(table) => [
  uniqueIndex("user_guild_unique_idx").on(table.userId, table.guildId)]);

export const userLevelsRelations = relations(userLevels, ({ one }) => ({
    user: one(users, {
        fields: [userLevels.userId],
        references: [users.id]
    }),
    guild: one(guilds, {
        fields: [userLevels.guildId],
        references: [guilds.id]
    })
}));

// Indexes (created via migrations)
export const indexes = {
    warningsUserIdIdx: "warnings_user_id_idx",
    warningsGuildIdIdx: "warnings_guild_id_idx",
    cooldownsUserIdCommandIdx: "cooldowns_user_id_command_idx",
    cooldownsExpiresAtIdx: "cooldowns_expires_at_idx",
    auditLogsGuildIdIdx: "audit_logs_guild_id_idx",
    auditLogsUserIdIdx: "audit_logs_user_id_idx",
    auditLogsCreatedAtIdx: "audit_logs_created_at_idx"
};