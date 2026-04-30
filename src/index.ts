import {
    Client,
    GatewayIntentBits,
    Collection,
    GuildMember,
    TextChannel,
    PermissionFlagsBits,
    Message,
    REST,
    Routes
} from "discord.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { Command } from "./types";
import { Context } from "./context";

// Load environment variables
dotenv.config();

// Validate required environment variables
if (!process.env.DISCORD_TOKEN) {
    console.error("Missing DISCORD_TOKEN in .env file");
    process.exit(1);
}

if (!process.env.OWNER_ID || process.env.OWNER_ID.trim() === "") {
    console.error("Missing or empty OWNER_ID in .env file");
    process.exit(1);
}

// Max number of unique users tracked per command to prevent memory exhaustion
const MAX_COOLDOWN_USERS = 10_000;

class ExtendedClient extends Client {
    public commands = new Collection<string, Command>();
    public cooldowns = new Collection<string, Collection<string, number[]>>();
}

// Initialize the Discord client with required intents
const client = new ExtendedClient({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Allowlist of valid file extensions for command files
const VALID_EXTENSIONS = new Set([".ts", ".js"]);

const foldersPath = path.join(__dirname, "commands");
fs.readdirSync(foldersPath).forEach(folder => {
    const fullPath = path.join(foldersPath, folder);

    // Ensure the resolved path stays within the commands directory
    const resolvedFolder = path.resolve(fullPath);
    const resolvedBase = path.resolve(foldersPath);
    if (!resolvedFolder.startsWith(resolvedBase + path.sep)) return;

    if (fs.statSync(fullPath).isDirectory()) {
        fs.readdirSync(fullPath)
            .filter(f => VALID_EXTENSIONS.has(path.extname(f)))
            .forEach(file => {
                const filePath = path.join(fullPath, file);

                // Guard: resolved file path must stay within the commands folder
                const resolvedFile = path.resolve(filePath);
                if (!resolvedFile.startsWith(resolvedBase + path.sep)) return;

                const cmd: Command = require(filePath).default;
                cmd.category = folder.toUpperCase();
                client.commands.set(cmd.name, cmd);
            });
    }
});

async function runValidation(
    command: Command,
    ctx: any,
    userId: string,
    member: GuildMember | null,
    channel: any,
    isOwner: boolean
): Promise<string | null> {
    const conf = { ...(command.conf ?? {}) };

    if (conf.ownerOnly && !isOwner)
        return "This Command can only be used by the Bot Owner.";

    if (conf.nsfwOnly && !(channel as TextChannel).nsfw)
        return "🔞 This command can only be used in NSFW channels.";

    if (
        conf.modOnly &&
        member &&
        !member.permissions.has(PermissionFlagsBits.ManageGuild)
    )
        return "You do not have permission to use this command.";

    // Block users with explicitly disallowed roles
    if (conf.disallowedRoles && conf.disallowedRoles.length > 0 && member) {
        const hasDisallowedRole = member.roles.cache.some(r =>
            conf.disallowedRoles!.includes(r.id)
        );
        if (hasDisallowedRole && !isOwner)
            return "You are not allowed to use this command.";
    }

    if (conf.allowedRoles && conf.allowedRoles.length > 0 && member) {
        const hasRole = member.roles.cache.some(r =>
            conf.allowedRoles!.includes(r.id)
        );
        if (!hasRole && !isOwner)
            return "You do not have the required role to use this.";
    }

    if (conf.requireHierarchy && member && "mentions" in ctx) {
        const target = ctx.mentions.members?.first();
        if (
            target &&
            target.roles.highest.position >= member.roles.highest.position &&
            !isOwner
        ) {
            return "You cannot modify a user with a higher/equal role.";
        }
    }

    if (!client.cooldowns.has(command.name))
        client.cooldowns.set(command.name, new Collection());

    const timestamps = client.cooldowns.get(command.name)!;
    const now = Date.now();
    const cooldownAmount = (conf.cooldown?.time || 3) * 1000;
    const maxUses = conf.cooldown?.limit || 1;

    const userTimestamps = timestamps.get(userId) || [];
    const validTimestamps = userTimestamps.filter(
        t => now < t + cooldownAmount
    );

    if (validTimestamps.length >= maxUses && !isOwner) {
        const waitTime = (
            (validTimestamps[0] + cooldownAmount - now) /
            1000
        ).toFixed(1);
        return `⏳ Wait ${waitTime}s before using this command again.`;
    }

    validTimestamps.push(now);
    timestamps.set(userId, validTimestamps);

    // Evict oldest entry if the per-command user map grows too large
    if (timestamps.size > MAX_COOLDOWN_USERS) {
        const oldestKey = timestamps.firstKey();
        if (oldestKey) timestamps.delete(oldestKey);
    }

    return null;
}

client.on("messageCreate", async (message: Message) => {
    if (message.author.bot) return;
    const prefix = process.env.PREFX || "$"; // example prefix
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();
    if (!commandName) return;

    const command = client.commands.get(commandName);
    if (!command) return;

    const member = message.member;
    const channel = message.channel as TextChannel | null;

    const error = await runValidation(
        command,
        message,
        message.author.id,
        member,
        channel,
        message.author.id === process.env.OWNER_ID
    );
    if (error) return message.reply(error);
    const ctx = new Context(message, args);
    try {
        await command.execute(ctx);
    } catch (err) {
        console.error("[Command Error]", command.name, err instanceof Error ? err.message : String(err));
        message.reply("There was an error running this command.");
    }
});

client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    const member = interaction.member as GuildMember;
    const channel = interaction.channel as TextChannel | null;
    const isOwner = interaction.user.id === process.env.OWNER_ID;

    const validation = await runValidation(
        command,
        interaction,
        interaction.user.id,
        member,
        channel,
        isOwner
    );
    if (validation)
        return interaction.reply({ content: validation, ephemeral: true });
    const ctx = new Context(interaction, []);
    try {
        await command.execute(ctx);
    } catch (err) {
        console.error("[Command Error]", command.name, err instanceof Error ? err.message : String(err));
        interaction.reply({
            content: "There was an error running this command.",
            ephemeral: true
        });
    }
});

// Ready event - fires when bot successfully connects
client.once("clientReady", async readyClient => {
    console.log(`Quinn is online! Logged in as ${readyClient.user.tag}`);
    console.log(`Serving ${readyClient.guilds.cache.size} guild(s)`);
    const rest = new REST({ version: "10" }).setToken(
        process.env.DISCORD_TOKEN!
    );
    const testGuildId = process.env.TEST_GUILD_ID;
    const useTestGuild = process.env.USE_TEST_GUILD === "true";
    try {
        console.log("Started refreshing application (/) commands...");

        const slashCommandsData = client.commands.map(cmd => ({
            name: cmd.name,
            description: cmd.description,
            options: cmd.options || []
        }));

        if (useTestGuild && testGuildId) {
            console.log(`Pushing commands to test server: ${testGuildId}...`);
            await rest.put(
                Routes.applicationGuildCommands(
                    readyClient.user.id,
                    testGuildId
                ),
                { body: slashCommandsData }
            );
            console.log("Successfully reloaded local guild (/) commands.");
        } else {
            console.log("Pushing commands globally...");
            await rest.put(Routes.applicationCommands(readyClient.user.id), {
                body: slashCommandsData
            });
            console.log("Successfully reloaded global (/) commands.");
        }
    } catch (error) {
        console.error("Failed to register slash commands:", error instanceof Error ? error.message : String(error));
    }
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);
