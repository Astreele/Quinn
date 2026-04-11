import { ApplicationCommandOptionType } from "discord.js";
import { GuildCommand } from "../../../types";
import { createInfoEmbed } from "../../../utils/embedBuilder";
import { resolveTargetMember } from "../../../utils/moderationHelpers";
import { warningsDB } from "./warn";

const warnings: GuildCommand = {
  name: "warnings",
  description: "Displays a list of previous warnings for a specific user.",
  conf: {
    modOnly: true,
    guildOnly: true,
  },
  options: [
    {
      name: "target",
      description: "The user to check warnings for",
      type: ApplicationCommandOptionType.User,
      required: true,
    },
  ],
  async execute(ctx) {
    const targetMember = await resolveTargetMember(ctx, "target", 0);
    if (!targetMember) return;

    const guildWarnings = warningsDB.get(ctx.guild.id);
    const userWarnings = guildWarnings?.get(targetMember.id) || [];

    if (userWarnings.length === 0) {
      await ctx.reply({
        embeds: [
          createInfoEmbed(
            ctx,
            `Warnings for <@${targetMember.user.id}>`,
            `<@${targetMember.user.id}> has no warnings.`
          ),
        ],
      });
      return;
    }

    const warningList = userWarnings
      .map(
        (w, i) => `**${i + 1}.** [${w.date.toLocaleDateString()}] ${w.reason}`
      )
      .join("\n");
    await ctx.reply({
      embeds: [
        createInfoEmbed(
          ctx,
          `Warnings for <@${targetMember.user.id}>`,
          warningList
        ),
      ],
    });
  },
};

export default warnings;
