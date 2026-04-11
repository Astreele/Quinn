import { EmbedBuilder, ColorResolvable } from "discord.js";
import { Context } from "../context";

/**
 * Creates a base embed with common footer and timestamp.
 * This is the foundation for all embed builders.
 */
function createBaseEmbed(
  ctx: Context,
  color: ColorResolvable = "Yellow"
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(color)
    .setFooter({ text: `Requested by ${ctx.author.username}` })
    .setTimestamp();
}

/**
 * Creates an informational embed with yellow color.
 * Use for general information, help, or neutral responses.
 *
 * @param ctx - The command context
 * @param title - The title of the embed
 * @param description - Optional description content
 */
export function createInfoEmbed(
  ctx: Context,
  title: string,
  description?: string
): EmbedBuilder {
  const embed = createBaseEmbed(ctx, "Yellow").setTitle(title);
  if (description) {
    embed.setDescription(description);
  }
  return embed;
}

/**
 * Creates an error embed with red color.
 * Use for validation failures, permission errors, or user mistakes.
 *
 * @param ctx - The command context
 * @param title - The error title
 * @param description - Optional description of the error
 */
export function createErrorEmbed(
  ctx: Context,
  title: string,
  description?: string
): EmbedBuilder {
  const embed = createBaseEmbed(ctx, "Red").setTitle(title);
  if (description) {
    embed.setDescription(description);
  }
  return embed;
}

/**
 * Creates a success embed with green color.
 * Use for successful actions, confirmations, or positive responses.
 *
 * @param ctx - The command context
 * @param title - The success title
 * @param description - Optional description of the success
 */
export function createSuccessEmbed(
  ctx: Context,
  title: string,
  description?: string
): EmbedBuilder {
  const embed = createBaseEmbed(ctx, "Green").setTitle(title);
  if (description) {
    embed.setDescription(description);
  }
  return embed;
}

/**
 * Creates a warning embed with orange color.
 * Use for warnings, cautions, or important notices.
 *
 * @param ctx - The command context
 * @param title - The warning title
 * @param description - Optional description of the warning
 */
export function createWarningEmbed(
  ctx: Context,
  title: string,
  description?: string
): EmbedBuilder {
  const embed = createBaseEmbed(ctx, "Orange").setTitle(title);
  if (description) {
    embed.setDescription(description);
  }
  return embed;
}

/**
 * Creates a neutral embed with blurple color.
 * Use for general purpose responses that don't fit other categories.
 *
 * @param ctx - The command context
 * @param title - The title of the embed
 * @param description - Optional description content
 */
export function createNeutralEmbed(
  ctx: Context,
  title: string,
  description?: string
): EmbedBuilder {
  const embed = createBaseEmbed(ctx, "Blurple").setTitle(title);
  if (description) {
    embed.setDescription(description);
  }
  return embed;
}
