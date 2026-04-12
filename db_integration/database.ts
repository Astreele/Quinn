import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { logger } from "../src/utils/logger";
import * as schema from "./schema";

// Create a singleton database connection
class DatabaseService {
  private pool: Pool | null = null;
  private db: NodePgDatabase<typeof schema> | null = null;
  private isConnected = false;

  async connect(databaseUrl: string): Promise<NodePgDatabase<typeof schema>> {
    try {
      this.pool = new Pool({
        connectionString: databaseUrl,
        ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
      });

      // Test the connection
      await this.pool.query("SELECT NOW()");

      this.db = drizzle(this.pool, { schema });
      this.isConnected = true;

      logger.info("Database connected successfully");
      return this.db;
    } catch (error) {
      logger.error("Failed to connect to database:", error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      try {
        await this.pool.end();
        this.pool = null;
        this.db = null;
        this.isConnected = false;
        logger.info("Database disconnected");
      } catch (error) {
        logger.error("Error disconnecting from database:", error);
        throw error;
      }
    }
  }

  getDb(): NodePgDatabase<typeof schema> {
    if (!this.db || !this.isConnected) {
      throw new Error("Database not connected. Call connect() first.");
    }
    return this.db;
  }

  get connected(): boolean {
    return this.isConnected;
  }
}

// Create a singleton instance
export const database = new DatabaseService();

// Export schema for easy access
export { schema };

// Export commonly used types
export type User = typeof schema.users.$inferSelect;
export type NewUser = typeof schema.users.$inferInsert;
export type Warning = typeof schema.warnings.$inferSelect;
export type NewWarning = typeof schema.warnings.$inferInsert;
export type Cooldown = typeof schema.cooldowns.$inferSelect;
export type NewCooldown = typeof schema.cooldowns.$inferInsert;
export type Guild = typeof schema.guilds.$inferSelect;
export type NewGuild = typeof schema.guilds.$inferInsert;
export type AuditLog = typeof schema.auditLogs.$inferSelect;
export type NewAuditLog = typeof schema.auditLogs.$inferInsert;
