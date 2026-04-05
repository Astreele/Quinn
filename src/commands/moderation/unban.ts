import { ApplicationCommandOptionType, EmbedBuilder } from "discord.js";
import { GuildCommand } from "../../types";

const unban: GuildCommand = {
    name: "unban",
    description: "Revokes a ban on a user.",
    category: "moderation",
    conf: {
        modOnly: true,
        guildOnly: true
    },
    options: [
        {
            name: "userid",
            description: "The ID of the user to unban",
            type: ApplicationCommandOptionType.String,
            required: true
        },
        {
            name: "reason",
            description: "The reason for unbanning the user",
            type: ApplicationCommandOptionType.String,
            required: false
        }
    ],
    async execute(ctx) {
        const targetId = ctx.parseString("userid", 0);
        const reason =
            ctx.parseString("reason", 1, true) || "No reason provided.";

        const embed = new EmbedBuilder()
            .setFooter({ text: `Requested by ${ctx.author.username}` })
            .setTimestamp()
            .setColor("Red");

        if (!targetId) {
            embed.setDescription("Please specify a valid user ID to unban.");
            await ctx.reply({ embeds: [embed] });
            return;
        }

        // Defer here because fetching bans can take longer than 3 seconds on large servers
        await ctx.defer();

        try {
            // Attempt to fetch the specific ban rather than the entire guild's ban list
            const ban = await ctx.guild.bans.fetch(targetId).catch(() => null);
            if (!ban) {
                embed.setDescription("That user is not currently banned.");
                await ctx.reply({ embeds: [embed] });
                return;
            }

            await ctx.guild.members.unban(targetId, reason);
            embed
                .setTitle(`Successfully unbanned user with ID ${targetId}.`)
                .setDescription(` Reason: ${reason}`)
                .setColor("Yellow");
            await ctx.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            embed
                .setTitle("An error occurred while trying to unban the user.")
                .setDescription("Ensure I have the permisson.");
            await ctx.reply({ embeds: [embed] });
        }
    }
};

export default unban;
