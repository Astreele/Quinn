import { Client, Collection, ClientOptions } from "discord.js";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Command } from "./types";
import * as schema from "./db/schema";

export class ExtendedClient extends Client {
  public commands = new Collection<string, Command>();
  public prefixShortcuts = new Collection<string, Command>();
  public db: NodePgDatabase<typeof schema> | null = null;

  constructor(options: ClientOptions) {
    super(options);
  }

  public setDatabase(db: NodePgDatabase<typeof schema>): void {
    this.db = db;
  }

  public hasDatabase(): boolean {
    return this.db !== null;
  }
}
