import { ApplicationCommandOptionType } from "discord.js";
import { GuildCommand } from "../../types";
import { createErrorEmbed, createInfoEmbed } from "../../utils/embedBuilder";

// A basic map to store user warnings in memory.
// Structure: Map<guildId, Map<userId, { reason: string, date: Date }[]>>
export const warningsDB: Map<
  string,
  Map<string, { reason: string; date: Date }[]>
> = new Map();

const warn: GuildCommand = {
  name: "warn",
  description: "Issues a formal warning to a user.",
  category: "moderation",
  conf: {
    modOnly: true,
    requireHierarchy: true,
    guildOnly: true,
  },
  options: [
    {
      name: "target",
      description: "The user to warn",
      type: ApplicationCommandOptionType.User,
      required: true,
    },
    {
      name: "reason",
      description: "The reason for the warning",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  async execute(ctx) {
    const targetMember = await ctx.parseMember("target", 0);
    const reason = ctx.parseString("reason", 1, true);

    if (!targetMember) {
      await ctx.reply({
        embeds: [
          createErrorEmbed(
            ctx,
            "Please specify a valid user.",
            "Could not find that user in the server."
          ),
        ],
      });
      return;
    }

    if (!reason) {
      await ctx.reply({
        embeds: [
          createErrorEmbed(ctx, "Missing Reason", "Please specify a reason."),
        ],
      });
      return;
    }

    if (targetMember.user.bot) {
      await ctx.reply({
        embeds: [createErrorEmbed(ctx, "Invalid Target", "You cannot warn a bot.")],
      });
      return;
    }

    // Save warning to memory
    if (!warningsDB.has(ctx.guild.id)) {
      warningsDB.set(ctx.guild.id, new Map());
    }

    const guildWarnings = warningsDB.get(ctx.guild.id)!;
    if (!guildWarnings.has(targetMember.id)) {
      guildWarnings.set(targetMember.id, []);
    }

    const userWarnings = guildWarnings.get(targetMember.id)!;
    userWarnings.push({ reason, date: new Date() });

    try {
      // Attempt to DM the user
      const dmEmbed = createInfoEmbed(
        ctx,
        `You have been warned in **${ctx.guild.name}**.`,
        `for: ${reason}`
      ).setColor("Red");

      await targetMember.send({ embeds: [dmEmbed] }).catch(() => null);

      await ctx.reply({
        embeds: [
          createInfoEmbed(
            ctx,
            `Successfully warned <@${targetMember.user.id}>.`,
            `This user now has ${userWarnings.length} warning(s).`
          ),
        ],
      });
    } catch (error) {
      console.error(error);
      await ctx.reply({
        embeds: [
          createInfoEmbed(
            ctx,
            `Warning recorded for <@${targetMember.user.id}>`,
            "but I could not DM them."
          ),
        ],
      });
    }
  },
};

export default warn;
