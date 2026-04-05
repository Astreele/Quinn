import { ApplicationCommandOptionType, EmbedBuilder } from "discord.js";
import { GuildCommand } from "../../types";

// A basic map to store user warnings in memory.
// Structure: Map<guildId, Map<userId, { reason: string, date: Date }[]>>
export const warningsDB: Map<
    string,
    Map<string, { reason: string; date: Date }[]>
> = new Map();

const warn: GuildCommand = {
    name: "warn",
    description: "Issues a formal warning to a user.",
    category: "moderation",
    conf: {
        modOnly: true,
        requireHierarchy: true,
        guildOnly: true
    },
    options: [
        {
            name: "target",
            description: "The user to warn",
            type: ApplicationCommandOptionType.User,
            required: true
        },
        {
            name: "reason",
            description: "The reason for the warning",
            type: ApplicationCommandOptionType.String,
            required: true
        }
    ],
    async execute(ctx) {
        const targetMember = await ctx.parseMember("target", 0);
        const reason = ctx.parseString("reason", 1, true);

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

        if (!reason) {
            embed.setDescription("Please specify a reason.");

            await ctx.reply({ embeds: [embed] });
            return;
        }

        if (targetMember.user.bot) {
            embed.setDescription("You cannot warn a bot.");

            await ctx.reply({ embeds: [embed] });
            return;
        }

        // Save warning to memory
        if (!warningsDB.has(ctx.guild.id)) {
            warningsDB.set(ctx.guild.id, new Map());
        }

        const guildWarnings = warningsDB.get(ctx.guild.id)!;
        if (!guildWarnings.has(targetMember.id)) {
            guildWarnings.set(targetMember.id, []);
        }

        const userWarnings = guildWarnings.get(targetMember.id)!;
        userWarnings.push({ reason, date: new Date() });

        try {
            // Attempt to DM the user
            embed
                .setTitle(`You have been warned in **${ctx.guild.name}**.`)
                .setDescription(`for: ${reason}`);

            await targetMember.send({ embeds: [embed] }).catch(() => null);

            embed
                .setTitle(`Successfully warned <@${targetMember.user.id}>.`)
                .setDescription(
                    `This user now has ${userWarnings.length} warning(s).`
                )
                .setColor("Yellow");

            await ctx.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            embed
                .setTitle(`Warning recorded for <@${targetMember.user.id}>`)
                .setDescription(`but I could not DM them.`);

            await ctx.reply({ embeds: [embed] });
        }
    }
};

export default warn;
