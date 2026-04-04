import { ApplicationCommandOptionType } from "discord.js";
import { Command } from "../../types";

// A basic map to store user warnings in memory.
// Structure: Map<guildId, Map<userId, { reason: string, date: Date }[]>>
export const warningsDB: Map<string, Map<string, { reason: string; date: Date }[]>> = new Map();

const warn: Command = {
    name: "warn",
    description: "Issues a formal warning to a user.",
    category: "moderation",
    conf: {
        modOnly: true,
        requireHierarchy: true,
    },
    options: [
        {
            name: "target",
            description: "The user to warn",
            type: ApplicationCommandOptionType.User,
            required: true,
        },
        {
            name: "reason",
            description: "The reason for the warning",
            type: ApplicationCommandOptionType.String,
            required: true,
        }
    ],
    async execute(ctx) {
        if (!ctx.guild) {
            await ctx.reply("This command can only be used in a server.");
            return;
        }

        const targetMember = await ctx.parseMember("target", 0);
        const reason = ctx.parseString("reason", 1, true);

        if (!targetMember) {
            await ctx.reply("Could not find that user in the server.");
            return;
        }

        if (!reason) {
            await ctx.reply("Please specify a reason.");
            return;
        }

        if (targetMember.user.bot) {
            await ctx.reply("You cannot warn a bot.");
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
            await targetMember.send(`You have been warned in **${ctx.guild.name}** for: ${reason}`).catch(() => null);
            await ctx.reply(`Successfully warned **${targetMember.user.tag}**. This user now has ${userWarnings.length} warning(s).`);
        } catch (error) {
            console.error(error);
            await ctx.reply(`Warning recorded for **${targetMember.user.tag}**, but I could not DM them.`);
        }
    }
};

export default warn;
