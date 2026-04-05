import { ApplicationCommandOptionType, EmbedBuilder } from "discord.js";
import { GuildCommand } from "../../types";

const kick: GuildCommand = {
  name: "kick",
  description: "Kicks a specified user from the server.",
  category: "moderation",
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

    const embed = new EmbedBuilder()
      .setFooter({ text: `Requested by ${ctx.author.username}` })
      .setTimestamp()
      .setColor("Red");

    if (!targetMember) {
      embed
        .setTitle("Please specify a valid user.")
        .setDescription("Could not find that user in the server.");
      await ctx.reply({ embeds: [embed] });
      return;
    }

    await ctx.defer();

    // Check if the bot can kick the user
    if (!targetMember.kickable) {
      embed
        .setTitle("I do not have permission to kick this user.")
        .setDescription(" Check my roles and permissions.");
      await ctx.reply({ embeds: [embed] });
      return;
    }

    try {
      embed
        .setTitle(`You have been kicked from **${ctx.guild.name}**.`)
        .setDescription(`Reason: ${reason}`);
      // Attempt to DM the target user before kicking (if they allow DMs)
      await targetMember.send({ embeds: [embed] }).catch(() => null);

      await targetMember.kick(reason);
      embed
        .setTitle(`Successfully kicked **${targetMember.user.tag}**.`)
        .setDescription(`Reason: ${reason}`)
        .setColor("Yellow");
      await ctx.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      embed.setDescription("An error occurred while trying to kick the user.");
      await ctx.reply({ embeds: [embed] });
    }
  },
};

export default kick;
