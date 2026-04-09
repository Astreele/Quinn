import { ApplicationCommandOptionType } from "discord.js";
import { GuildCommand } from "../../types";
import { createErrorEmbed, createInfoEmbed } from "../../utils/embedBuilder";

const untimeout: GuildCommand = {
  name: "untimeout",
  description: "Removes a timeout from a user.",
  category: "moderation",
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

    if (!targetMember.moderatable) {
      await ctx.reply({
        embeds: [
          createErrorEmbed(
            ctx,
            "Permission Denied",
            "I do not have permission to untimeout this user."
          ),
        ],
      });
      return;
    }

    try {
      await targetMember.timeout(null, reason);
      await ctx.reply({
        embeds: [
          createInfoEmbed(
            ctx,
            `Successfully removed timeout from <@${targetMember.user.id}>.`,
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
            "Untimeout Failed",
            "An error occurred while trying to untimeout the user."
          ),
        ],
      });
    }
  },
};

export default untimeout;
