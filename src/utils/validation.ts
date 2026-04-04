import { GuildMember, PermissionFlagsBits, Collection } from "discord.js";
import { Command } from "../types";
import { ExtendedClient } from "../client";
import { Context, CommandContext, MessageContext } from "../context";
import { logger } from "./logger";

/**
 * Validates a command execution request against its configured CommandConfig limitations.
 * 
 * @param client The ExtendedClient instance.
 * @param command The command object being requested.
 * @param ctx The originating message or interaction context.
 * @param userId The Discord ID of the user requesting execution.
 * @param member The GuildMember object of the requester, if available.
 * @param channel The TextChannel where the invocation occurred.
 * @param isOwner A boolean indicating if the requester is the bot owner.
 * @returns A string containing an error message if validation fails, or null if validation passes.
 */
export async function runValidation(
    client: ExtendedClient,
    command: Command,
    ctx: Context,
    isOwner: boolean
): Promise<string | null> {
    const conf = { ...command.conf };
    const member = ctx.member;
    const channel = ctx.channel;
    const userId = ctx.author.id;

    if (conf.ownerOnly && !isOwner)
        return "This Command can only be used by the Bot Owner.";

    if (conf.nsfwOnly && channel && "nsfw" in channel && !channel.nsfw)
        return "🔞 This command can only be used in NSFW channels.";

    if (
        conf.modOnly &&
        member &&
        !member.permissions.has(PermissionFlagsBits.ManageGuild)
    )
        return "You do not have permission to use this command.";

    if (conf.allowedRoles && conf.allowedRoles.length > 0 && member) {
        const hasRole = member.roles.cache.some(r =>
            conf.allowedRoles!.includes(r.id)
        );
        if (!hasRole && !isOwner)
            return "You do not have the required role to use this.";
    }

    if (conf.requireHierarchy && member) {
        let target: GuildMember | null = null;
        if (ctx instanceof CommandContext) {
            const user = ctx.command.options.getUser("user") || ctx.command.options.getUser("target");
            if (user && ctx.guild) {
                target = ctx.guild.members.cache.get(user.id) || null;
            }
        } else if (ctx instanceof MessageContext) {
            target = ctx.message.mentions.members?.first() || null;
        }

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

    setTimeout(() => {
        const currentTimestamps = timestamps.get(userId);
        if (currentTimestamps) {
            const filtered = currentTimestamps.filter(t => t !== now);
            if (filtered.length === 0) {
                timestamps.delete(userId);
            } else {
                timestamps.set(userId, filtered);
            }
        }
    }, cooldownAmount);

    return null;
}

/**
 * Handles validation and execution seamlessly for any unified command.
 * @param client The bot's ExtendedClient instance.
 * @param command The unified Command object.
 * @param ctx The generated Context.
 */
export async function executeWithValidation(
    client: ExtendedClient,
    command: Command,
    ctx: Context
) {
    const isOwner = ctx.author.id === process.env.OWNER_ID;

    const error = await runValidation(
        client,
        command,
        ctx,
        isOwner
    );

    if (error) {
        logger.warn(`User ${ctx.author.tag} (${ctx.author.id}) was blocked from running command '${command.name}': ${error}`);
        return ctx.reply(error, { ephemeral: true });
    }

    try {
        logger.info(`User ${ctx.author.tag} (${ctx.author.id}) is executing command: ${command.name}`);
        await command.execute(ctx);
        logger.info(`Successfully executed command: ${command.name} for ${ctx.author.tag}`);
    } catch (err) {
        logger.error(`Error executing command ${command.name} for ${ctx.author.tag}:`, err);
        ctx.reply("There was an error running this command.", { ephemeral: true });
    }
}
