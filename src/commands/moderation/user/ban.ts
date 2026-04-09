import { ApplicationCommandOptionType } from "discord.js";
import { GuildCommand } from "../../../types";
import { createErrorEmbed, createInfoEmbed } from "../../../utils/embedBuilder";
import { dmUser, assertBotPermission, executeModerationAction } from "../../../utils/moderationHelpers";

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

    const member = await ctx.guild.members
      .fetch(targetUser.id)
      .catch(() => null);
    if (member && !(await assertBotPermission(ctx, member, "ban"))) {
      return;
    }

    await dmUser(targetUser, ctx.guild.name, "banned", reason, ctx);

    const success = await executeModerationAction(
      ctx,
      async () => {
        await ctx.guild.members.ban(targetUser.id, { reason });
      },
      "ban"
    );

    if (success) {
      await ctx.reply({
        embeds: [
          createInfoEmbed(
            ctx,
            `Successfully banned **${targetUser.tag}**.`,
            `Reason: ${reason}`
          ),
        ],
      });
    }
  },
};

export default ban;
