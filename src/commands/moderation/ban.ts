import { ApplicationCommandOptionType, EmbedBuilder } from "discord.js";
import { GuildCommand } from "../../types";

const ban: GuildCommand = {
  name: "ban",
  description: "Bans a specified user from the server.",
  category: "moderation",
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

    const embed = new EmbedBuilder()
      .setFooter({ text: `Requested by ${ctx.author.username}` })
      .setTimestamp()
      .setColor("Red");

    if (!targetUser) {
      embed
        .setTitle("Please specify a valid user.")
        .setDescription("Could not identify the user to ban.");
      await ctx.reply({ embeds: [embed] });
      return;
    }

    await ctx.defer();

    try {
      // Attempt to fetch member to check hierarchy if they are in the server
      const member = await ctx.guild.members
        .fetch(targetUser.id)
        .catch(() => null);
      if (member && !member.bannable) {
        embed
          .setTitle("I do not have permission to kick this user.")
          .setDescription(" Check my roles and permissions.");
        await ctx.reply({ embeds: [embed] });
        return;
      }

      embed
        .setTitle(`You have been banned from **${ctx.guild.name}**.`)
        .setDescription(`Reason: ${reason}`);
      // Attempt to DM the target user before baning (if they allow DMs)
      await targetUser.send({ embeds: [embed] }).catch(() => null);

      await ctx.guild.members.ban(targetUser.id, { reason });
      const userDisplay = targetUser.tag;
      embed
        .setTitle(`Successfully banned **${userDisplay}**.`)
        .setDescription(`Reason: ${reason}`)
        .setColor("Yellow");
      await ctx.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      embed.setDescription("An error occurred while trying to ban the user.");
      await ctx.reply({ embeds: [embed] });
    }
  },
};

export default ban;
