import { Client, Collection, ClientOptions } from "discord.js";
import { Command } from "./types";

export class ExtendedClient extends Client {
  public commands = new Collection<string, Command>();
  public prefixShortcuts = new Collection<string, Command>();
  public cooldowns = new Collection<string, Collection<string, number[]>>();

  constructor(options: ClientOptions) {
    super(options);
  }
}
