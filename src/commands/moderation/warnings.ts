import { ApplicationCommandOptionType } from "discord.js";
import { Command } from "../../types";
import { warningsDB } from "./warn";

const warnings: Command = {
    name: "warnings",
    description: "Displays a list of previous warnings for a specific user.",
    category: "moderation",
    conf: {
        modOnly: true,
    },
    options: [
        {
            name: "target",
            description: "The user to check warnings for",
            type: ApplicationCommandOptionType.User,
            required: true,
        }
    ],
    async execute(ctx) {
        if (!ctx.guild) {
            await ctx.reply("This command can only be used in a server.");
            return;
        }

        const targetMember = await ctx.parseMember("target", 0);

        if (!targetMember) {
            await ctx.reply("Could not find that user in the server. Please specify a valid user.");
            return;
        }

        const guildWarnings = warningsDB.get(ctx.guild.id);
        const userWarnings = guildWarnings?.get(targetMember.id) || [];

        if (userWarnings.length === 0) {
            await ctx.reply(`**${targetMember.user.tag}** has no warnings.`);
            return;
        }

        const warningList = userWarnings.map((w, i) => `**${i + 1}.** [${w.date.toLocaleDateString()}] ${w.reason}`).join("\n");
        await ctx.reply(`**Warnings for ${targetMember.user.tag}:**\n${warningList}`);
    }
};

export default warnings;
