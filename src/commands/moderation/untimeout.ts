import { ApplicationCommandOptionType, EmbedBuilder } from "discord.js";
import { GuildCommand } from "../../types";

const untimeout: GuildCommand = {
    name: "untimeout",
    description: "Removes a timeout from a user.",
    category: "moderation",
    conf: {
        modOnly: true,
        requireHierarchy: true,
        guildOnly: true
    },
    options: [
        {
            name: "target",
            description: "The user to untimeout",
            type: ApplicationCommandOptionType.User,
            required: true
        },
        {
            name: "reason",
            description: "The reason for removing the timeout",
            type: ApplicationCommandOptionType.String,
            required: false
        }
    ],
    async execute(ctx) {
        const targetMember = await ctx.parseMember("target", 0);
        const reason =
            ctx.parseString("reason", 1, true) || "No reason provided.";

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

        if (!targetMember.isCommunicationDisabled()) {
            embed.setDescription("That user is not currently timed out.");
            await ctx.reply({ embeds: [embed] });
            return;
        }

        if (!targetMember.moderatable) {
            embed.setDescription(
                "I do not have permission to untimeout this user."
            );
            await ctx.reply({ embeds: [embed] });
            return;
        }

        try {
            await targetMember.timeout(null, reason);
            embed
                .setTitle(
                    `Successfully removed timeout from <@${targetMember.user.id}>.`
                )
                .setDescription(`Reason: ${reason}`)
                .setColor("Yellow");
            await ctx.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            embed.setDescription(
                "An error occurred while trying to untimeout the user."
            );
            await ctx.reply({ embeds: [embed] });
        }
    }
};

export default untimeout;
