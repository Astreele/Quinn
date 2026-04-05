import { ApplicationCommandOptionType, EmbedBuilder } from "discord.js";
import { GuildCommand } from "../../types";
import { warningsDB } from "./warn";

const warnings: GuildCommand = {
    name: "warnings",
    description: "Displays a list of previous warnings for a specific user.",
    category: "moderation",
    conf: {
        modOnly: true,
        guildOnly: true
    },
    options: [
        {
            name: "target",
            description: "The user to check warnings for",
            type: ApplicationCommandOptionType.User,
            required: true
        }
    ],
    async execute(ctx) {
        const embed = new EmbedBuilder()
            .setFooter({ text: `Requested by ${ctx.author.username}` })
            .setTimestamp()
            .setColor("Yellow");

        const targetMember = await ctx.parseMember("target", 0);

        if (!targetMember) {
            embed
                .setTitle("Please specify a valid user.")
                .setDescription("Could not find that user in the server.")
                .setColor("Red");
            await ctx.reply({ embeds: [embed] });
            return;
        }

        const guildWarnings = warningsDB.get(ctx.guild.id);
        const userWarnings = guildWarnings?.get(targetMember.id) || [];

        if (userWarnings.length === 0) {
            embed.setDescription(
                `<@${targetMember.user.id}> has no warnings.`
            );
            await ctx.reply({ embeds: [embed] });
            return;
        }

        const warningList = userWarnings
            .map(
                (w, i) =>
                    `**${i + 1}.** [${w.date.toLocaleDateString()}] ${w.reason}`
            )
            .join("\n");
        embed
            .setTitle(`Warnings for <@${targetMember.user.id}>`)
            .setDescription(`${warningList}`);
        await ctx.reply({ embeds: [embed] });
    }
};

export default warnings;
