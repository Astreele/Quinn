import { ApplicationCommandOptionType } from "discord.js";
import { GuildCommand } from "../../types";
import { createErrorEmbed, createInfoEmbed } from "../../utils/embedBuilder";

const unban: GuildCommand = {
  name: "unban",
  description: "Revokes a ban on a user.",
  category: "moderation",
  conf: {
    modOnly: true,
    guildOnly: true,
  },
  options: [
    {
      name: "userid",
      description: "The ID of the user to unban",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: "reason",
      description: "The reason for unbanning the user",
      type: ApplicationCommandOptionType.String,
      required: false,
    },
  ],
  async execute(ctx) {
    const targetId = ctx.parseString("userid", 0);
    const reason = ctx.parseString("reason", 1, true) || "No reason provided.";

    if (!targetId) {
      await ctx.reply({
        embeds: [
          createErrorEmbed(
            ctx,
            "Missing User ID",
            "Please specify a valid user ID to unban."
          ),
        ],
      });
      return;
    }

    // Defer here because fetching bans can take longer than 3 seconds on large servers
    await ctx.defer();

    try {
      // Attempt to fetch the specific ban rather than the entire guild's ban list
      const ban = await ctx.guild.bans.fetch(targetId).catch(() => null);
      if (!ban) {
        await ctx.reply({
          embeds: [
            createErrorEmbed(ctx, "User Not Banned", "That user is not currently banned."),
          ],
        });
        return;
      }

      await ctx.guild.members.unban(targetId, reason);
      await ctx.reply({
        embeds: [
          createInfoEmbed(
            ctx,
            `Successfully unbanned user with ID ${targetId}.`,
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
            "Unban Failed",
            "An error occurred while trying to unban the user. Ensure I have the permission."
          ),
        ],
      });
    }
  },
};

export default unban;
