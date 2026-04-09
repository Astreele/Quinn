import { GuildMember, User } from "discord.js";
import { GuildContext } from "../types";
import { createErrorEmbed, createInfoEmbed } from "./embedBuilder";
import { logger } from "./logger";

/**
 * Parses and validates a target member with automatic error response.
 * Sends an error reply and returns null if the member cannot be resolved.
 *
 * @param ctx - The guild command context
 * @param optionName - The name of the option to parse
 * @param position - The argument position for prefix commands
 * @returns The resolved GuildMember, or null if not found
 */
export async function resolveTargetMember(
  ctx: GuildContext,
  optionName: string,
  position: number
): Promise<GuildMember | null> {
  const target = await ctx.parseMember(optionName, position);

  if (!target) {
    await ctx.reply({
      embeds: [
        createErrorEmbed(
          ctx,
          "Please specify a valid user.",
          "Could not find that user in the server."
        ),
      ],
    });
    return null;
  }

  return target;
}

/**
 * Checks if the bot has permission to perform an action on a member.
 * Sends an error reply and returns false if the member is not manageable.
 *
 * @param ctx - The guild command context
 * @param member - The guild member to check permissions against
 * @param action - The type of action ("ban", "kick", "timeout", etc.)
 * @returns True if the bot has permission, false otherwise
 */
export async function assertBotPermission(
  ctx: GuildContext,
  member: GuildMember,
  action: "ban" | "kick" | "timeout"
): Promise<boolean> {
  const permissionMap = {
    ban: "bannable",
    kick: "kickable",
    timeout: "moderatable",
  } as const;

  const permission = permissionMap[action];

  if (!member[permission]) {
    await ctx.reply({
      embeds: [
        createErrorEmbed(
          ctx,
          `I do not have permission to ${action} this user.`,
          "Check my roles and permissions."
        ),
      ],
    });
    return false;
  }

  return true;
}

/**
 * Attempts to DM a user with an embed before taking a moderation action.
 * Silently fails if the user has DMs disabled.
 *
 * @param user - The user to DM
 * @param guildName - The name of the guild
 * @param action - The action being taken (e.g., "banned", "kicked", "warned")
 * @param reason - The reason for the action
 * @param ctx - The context for embed creation
 */
export async function dmUser(
  user: User,
  guildName: string,
  action: string,
  reason: string,
  ctx: GuildContext
): Promise<void> {
  const dmEmbed = createInfoEmbed(
    ctx,
    `You have been ${action} from **${guildName}**.`,
    `Reason: ${reason}`
  ).setColor("Red");
  await user.send({ embeds: [dmEmbed] }).catch(() => null);
}

/**
 * Executes a moderation action with standardized error handling.
 * Wraps the action in a try/catch and logs errors using the project logger.
 *
 * @param ctx - The guild command context
 * @param action - A function that performs the moderation action
 * @param actionName - A human-readable name for the action (e.g., "ban", "kick")
 * @returns True if the action succeeded, false if an error occurred
 */
export async function executeModerationAction(
  ctx: GuildContext,
  action: () => Promise<void>,
  actionName: string
): Promise<boolean> {
  try {
    await action();
    return true;
  } catch (error) {
    logger.error(`Error during ${actionName} action:`, error);
    await ctx.reply({
      embeds: [
        createErrorEmbed(
          ctx,
          `${actionName.charAt(0).toUpperCase() + actionName.slice(1)} Failed`,
          `An error occurred while trying to ${actionName} the user.`
        ),
      ],
    });
    return false;
  }
}
