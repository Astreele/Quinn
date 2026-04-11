import { ApplicationCommandOptionType } from "discord.js";
import { GuildCommand } from "../../../types";
import { createErrorEmbed, createInfoEmbed } from "../../../utils/embedBuilder";
import {
  dmUser,
  assertBotPermission,
  executeModerationAction,
} from "../../../utils/moderationHelpers";

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

    if (!(await assertBotPermission(ctx, targetMember, "kick"))) {
      return;
    }

    await dmUser(targetMember.user, ctx.guild.name, "kicked", reason, ctx);

    const success = await executeModerationAction(
      ctx,
      async () => {
        await targetMember.kick(reason);
      },
      "kick"
    );

    if (success) {
      await ctx.reply({
        embeds: [
          createInfoEmbed(
            ctx,
            `Successfully kicked **${targetMember.user.tag}**.`,
            `Reason: ${reason}`
          ),
        ],
      });
    }
  },
};

export default kick;
