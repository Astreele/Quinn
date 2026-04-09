import { ApplicationCommandOptionType } from "discord.js";
import { GuildCommand } from "../../../types";
import { createErrorEmbed, createInfoEmbed } from "../../../utils/embedBuilder";
import { resolveTargetMember, assertBotPermission, executeModerationAction } from "../../../utils/moderationHelpers";

const untimeout: GuildCommand = {
  name: "untimeout",
  description: "Removes a timeout from a user.",
  conf: {
    modOnly: true,
    requireHierarchy: true,
    guildOnly: true,
  },
  options: [
    {
      name: "target",
      description: "The user to untimeout",
      type: ApplicationCommandOptionType.User,
      required: true,
    },
    {
      name: "reason",
      description: "The reason for removing the timeout",
      type: ApplicationCommandOptionType.String,
      required: false,
    },
  ],
  async execute(ctx) {
    const targetMember = await resolveTargetMember(ctx, "target", 0);
    if (!targetMember) return;

    const reason = ctx.parseString("reason", 1, true) || "No reason provided.";

    await ctx.defer();

    if (!targetMember.isCommunicationDisabled()) {
      await ctx.reply({
        embeds: [
          createErrorEmbed(
            ctx,
            "Not Timed Out",
            "That user is not currently timed out."
          ),
        ],
      });
      return;
    }

    if (!(await assertBotPermission(ctx, targetMember, "timeout"))) {
      return;
    }

    const success = await executeModerationAction(
      ctx,
      async () => {
        await targetMember.timeout(null, reason);
      },
      "untimeout"
    );

    if (success) {
      await ctx.reply({
        embeds: [
          createInfoEmbed(
            ctx,
            `Successfully removed timeout from <@${targetMember.user.id}>.`,
            `Reason: ${reason}`
          ),
        ],
      });
    }
  },
};

export default untimeout;
