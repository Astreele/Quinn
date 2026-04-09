import { ApplicationCommandOptionType } from "discord.js";
import { Command } from "../../../types";
import { createInfoEmbed } from "../../../utils/embedBuilder";

const avatar: Command = {
  name: "avatar",
  description: "Shows a user's avatar in full size.",
  options: [
    {
      name: "user",
      description: "The user whose avatar you want to view",
      type: ApplicationCommandOptionType.User,
      required: false,
    },
  ],
  async execute(ctx) {
    const targetUser = (await ctx.parseUser("user", 0)) ?? ctx.author;
    const avatarUrl = targetUser.displayAvatarURL({
      extension: "png",
      size: 4096,
    });

    const embed = createInfoEmbed(ctx, `<@${targetUser.id}>'s Avatar`)
      .setURL(avatarUrl)
      .setImage(avatarUrl)
      .setDescription(`[Open original avatar](${avatarUrl})`);

    await ctx.reply({ embeds: [embed] });
  },
};

export default avatar;
