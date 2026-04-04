import { Client, Collection, ClientOptions } from "discord.js";
import { Command } from "./types";

/**
 * Extends the base Discord.js Client to include command and cooldown registries.
 */
export class ExtendedClient extends Client {
    /** A collection storing all loaded commands, mapped by their name. */
    public commands = new Collection<string, Command>();
    /** A collection managing user cooldowns for rate-limiting. mapped by command name -> (user ID -> timestamps) */
    public cooldowns = new Collection<string, Collection<string, number[]>>();

    constructor(options: ClientOptions) {
        super(options);
    }
}
