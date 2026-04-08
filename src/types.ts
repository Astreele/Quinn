import { ApplicationCommandOptionType, ClientEvents } from "discord.js";
import { Context } from "./context";

/**
 * Configuration options for restricting and controlling command execution.
 */
export interface CommandConfig {
  /** If true, the command can only be executed in channels marked as NSFW. */
  nsfwOnly?: boolean;
  /** If true, only the application owner (defined in .env) can execute this command. */
  ownerOnly?: boolean;
  /** If true, requires the executing user to have the ManageGuild permission. */
  modOnly?: boolean;
  /** If true, the command can only be executed in guilds. */
  guildOnly?: boolean;
  /** Array of Role IDs. The user must have at least one of these roles to execute the command. */
  allowedRoles?: string[];
  /** Array of Role IDs. If the user has any of these roles, execution is blocked. */
  disallowedRoles?: string[];
  /** Whether the command can be triggered via a standard message prefix. */
  allowPrefix?: boolean;
  /**
   * Rate limiting configuration to prevent command spam.
   * @property time The duration of the cooldown period in seconds.
   * @property limit The maximum number of executions allowed within the time period.
   */
  cooldown?: { time: number; limit: number };
  /**
   * Used primarily for moderation commands.
   * Validates that the executing user has a higher role hierarchy than the target user.
   */
  requireHierarchy?: boolean;
}

export interface CommandOption {
  /** The name of the option. Must be lowercase without spaces. */
  name: string;
  /** A description of what the option represents. */
  description: string;
  /** The data type expected for this option (e.g., STRING, USER, INTEGER). */
  type: ApplicationCommandOptionType;
  /** Whether the user is required to provide this option. */
  required?: boolean;
}

export interface Subcommand {
  /** The subcommand name used under the parent command. */
  name: string;
  /** A brief description of the subcommand. Required for slash commands. */
  description: string;
  /** Arguments accepted by the subcommand. */
  options?: CommandOption[];
  /** Optional execution constraints and rules. */
  conf?: CommandConfig;
  /**
   * The core execution logic of the subcommand.
   * @param ctx The abstracted Context wrapper detailing the invocation.
   */
  execute: (ctx: Context) => Promise<void>;
}

/**
 * Represents a unified bot command that can be executed via slash interactions or message prefixes.
 */
export interface Command {
  /** The name of the command. Acts as the slash command name and prefix trigger. */
  name: string;
  /** A brief description of the command's functionality. Required for slash commands. */
  description: string;
  /** Automatically populated category string based on the command's directory location. */
  category?: string;
  /** Arguments or parameters the command accepts. Directly maps to Discord ApplicationCommandOptions. */
  options?: CommandOption[];
  /** Optional slash/prefix subcommands that live under this command. */
  subcommands?: Subcommand[];
  /** Optional prefix-only fallback subcommand used when no subcommand token is provided. */
  defaultSubcommand?: string;
  /** Optional execution constraints and rules. */
  conf?: CommandConfig;
  /**
   * The core execution logic of the command.
   * @param ctx The abstracted Context wrapper detailing the invocation.
   */
  execute?: (ctx: Context) => Promise<void>;
}

/**
 * A specialized Context type that guarantees guild, channel, and member are not null.
 */
export type GuildContext = Context & {
  get guild(): import("discord.js").Guild;
  get channel(): import("discord.js").TextBasedChannel;
  get member(): import("discord.js").GuildMember;
};

/**
 * Represents a unified bot command that is strictly executed within a guild.
 */
export interface GuildCommand extends Omit<Command, "execute"> {
  execute?: (ctx: GuildContext) => Promise<void>;
}

/**
 * Represents an event listener for the bot context.
 */
export interface BotEvent<K extends keyof ClientEvents = keyof ClientEvents> {
  /** The name of the event to listen for (e.g., 'messageCreate', 'ready'). */
  name: K;
  /** If true, the listener is triggered only once. */
  once?: boolean;
  /**
   * The core execution logic of the event.
   * @param client The bot's ExtendedClient instance.
   * @param args The arguments emitted by the event, strictly typed.
   */
  execute: (
    client: import("./client").ExtendedClient,
    ...args: ClientEvents[K]
  ) => void | Promise<unknown> | unknown;
}
