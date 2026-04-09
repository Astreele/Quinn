import { ApplicationCommandOptionType } from "discord.js";
import { GuildCommand } from "../../../types";
import { createErrorEmbed, createInfoEmbed } from "../../../utils/embedBuilder";

const kick: GuildCommand = {
  name: "kick",
  description: "Kicks a specified user from the server.",
  conf: {
    modOnly: true,
    requireHierarchy: true,
    guildOnly: true,
  },
  options: [
    {
      name: "target",
      description: "The user to kick",
      type: ApplicationCommandOptionType.User,
      required: true,
    },
    {
      name: "reason",
      description: "The reason for kicking the user",
      type: ApplicationCommandOptionType.String,
      required: false,
    },
  ],
  async execute(ctx) {
    const targetMember = await ctx.parseMember("target", 0);
    const reason = ctx.parseString("reason", 1, true) || "No reason provided.";

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

    await ctx.defer();

    if (!targetMember.kickable) {
      await ctx.reply({
        embeds: [
          createErrorEmbed(
            ctx,
            "I do not have permission to kick this user.",
            "Check my roles and permissions."
          ),
        ],
      });
      return;
    }

    try {
      const dmEmbed = createInfoEmbed(
        ctx,
        `You have been kicked from **${ctx.guild.name}**.`,
        `Reason: ${reason}`
      ).setColor("Red");
      await targetMember.send({ embeds: [dmEmbed] }).catch(() => null);

      await targetMember.kick(reason);
      await ctx.reply({
        embeds: [
          createInfoEmbed(
            ctx,
            `Successfully kicked **${targetMember.user.tag}**.`,
            `Reason: ${reason}`
          ),
        ],
      });
    } catch (error) {
      console.error(error);
      await ctx.reply({
        embeds: [
          createErrorEmbed(
            ctx,
            "Kick Failed",
            "An error occurred while trying to kick the user."
          ),
        ],
      });
    }
  },
};

export default kick;
