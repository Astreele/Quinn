import { ApplicationCommandOptionType, ClientEvents } from "discord.js";
import { Context } from "./context";

export interface CommandConfig {
  nsfwOnly?: boolean;
  ownerOnly?: boolean;
  modOnly?: boolean;
  guildOnly?: boolean;
  allowedRoles?: string[];
  disallowedRoles?: string[];
  allowPrefix?: boolean;
  cooldown?: { time: number; limit: number };
  requireHierarchy?: boolean;
}

export interface CommandOption {
  name: string;
  description: string;
  type: ApplicationCommandOptionType;
  required?: boolean;
}

export interface Command {
  name: string;
  description: string;
  prefixName?: string;
  category?: string;
  options?: CommandOption[];
  conf?: CommandConfig;
  execute?: (ctx: Context) => Promise<void>;

  _children?: Map<string, Command>;
  _isGroup?: boolean;
}

export type GuildContext = Context & {
  get guild(): import("discord.js").Guild;
  get channel(): import("discord.js").TextBasedChannel;
  get member(): import("discord.js").GuildMember;
};

export interface GuildCommand extends Omit<Command, "execute"> {
  execute?: (ctx: GuildContext) => Promise<void>;
}

export interface BotEvent<K extends keyof ClientEvents = keyof ClientEvents> {
  name: K;
  once?: boolean;
  execute: (
    client: import("./client").ExtendedClient,
    ...args: ClientEvents[K]
  ) => void | Promise<unknown> | unknown;
}
