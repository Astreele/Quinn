import { ApplicationCommandOptionType } from "discord.js";
import { GuildCommand } from "../../types";
import { warningsDB } from "./warn";

const warnings: GuildCommand = {
  name: "warnings",
  description: "Displays a list of previous warnings for a specific user.",
  category: "moderation",
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
    const targetMember = await ctx.parseMember("target", 0);

    if (!targetMember) {
      await ctx.reply(
        "Could not find that user in the server. Please specify a valid user."
      );
      return;
    }

    const guildWarnings = warningsDB.get(ctx.guild.id);
    const userWarnings = guildWarnings?.get(targetMember.id) || [];

    if (userWarnings.length === 0) {
      await ctx.reply(`**${targetMember.user.tag}** has no warnings.`);
      return;
    }

    const warningList = userWarnings
      .map(
        (w, i) => `**${i + 1}.** [${w.date.toLocaleDateString()}] ${w.reason}`
      )
      .join("\n");
    await ctx.reply(
      `**Warnings for ${targetMember.user.tag}:**\n${warningList}`
    );
  },
};

export default warnings;
