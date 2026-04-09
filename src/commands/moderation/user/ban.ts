import { ApplicationCommandOptionType } from "discord.js";
import { GuildCommand } from "../../../types";
import { createErrorEmbed, createInfoEmbed } from "../../../utils/embedBuilder";

const ban: GuildCommand = {
  name: "ban",
  description: "Bans a specified user from the server.",
  conf: {
    modOnly: true,
    requireHierarchy: true,
    guildOnly: true,
  },
  options: [
    {
      name: "target",
      description: "The user to ban",
      type: ApplicationCommandOptionType.User,
      required: true,
    },
    {
      name: "reason",
      description: "The reason for banning the user",
      type: ApplicationCommandOptionType.String,
      required: false,
    },
  ],
  async execute(ctx) {
    const targetUser = await ctx.parseUser("target", 0);
    const reason = ctx.parseString("reason", 1, true) || "No reason provided.";

    if (!targetUser) {
      await ctx.reply({
        embeds: [
          createErrorEmbed(
            ctx,
            "Please specify a valid user.",
            "Could not identify the user to ban."
          ),
        ],
      });
      return;
    }

    await ctx.defer();

    try {
      const member = await ctx.guild.members
        .fetch(targetUser.id)
        .catch(() => null);
      if (member && !member.bannable) {
        await ctx.reply({
          embeds: [
            createErrorEmbed(
              ctx,
              "I do not have permission to ban this user.",
              "Check my roles and permissions."
            ),
          ],
        });
        return;
      }

      const dmEmbed = createInfoEmbed(
        ctx,
        `You have been banned from **${ctx.guild.name}**.`,
        `Reason: ${reason}`
      ).setColor("Red");
      await targetUser.send({ embeds: [dmEmbed] }).catch(() => null);

      await ctx.guild.members.ban(targetUser.id, { reason });
      const userDisplay = targetUser.tag;
      await ctx.reply({
        embeds: [
          createInfoEmbed(
            ctx,
            `Successfully banned **${userDisplay}**.`,
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
            "Ban Failed",
            "An error occurred while trying to ban the user."
          ),
        ],
      });
    }
  },
};

export default ban;
