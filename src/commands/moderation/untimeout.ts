import { ApplicationCommandOptionType } from "discord.js";
import { Command } from "../../types";

const untimeout: Command = {
    name: "untimeout",
    description: "Removes a timeout from a user.",
    category: "moderation",
    conf: {
        modOnly: true,
        requireHierarchy: true,
    },
    options: [
        {
            name: "target",
            description: "The user to untimeout",
            type: ApplicationCommandOptionType.User,
            required: true,
        },
        {
            name: "reason",
            description: "The reason for removing the timeout",
            type: ApplicationCommandOptionType.String,
            required: false,
        }
    ],
    async execute(ctx) {
        if (!ctx.guild) {
            await ctx.reply("This command can only be used in a server.");
            return;
        }

        const targetMember = await ctx.parseMember("target", 0);
        const reason = ctx.parseString("reason", 1, true) || "No reason provided.";

        if (!targetMember) {
            await ctx.reply("Could not find that user in the server. Please specify a valid user.");
            return;
        }

        await ctx.defer();

        if (!targetMember.isCommunicationDisabled()) {
            await ctx.reply("That user is not currently timed out.");
            return;
        }

        if (!targetMember.moderatable) {
            await ctx.reply("I do not have permission to untimeout this user.");
            return;
        }

        try {
            await targetMember.timeout(null, reason);
            await ctx.reply(`Successfully removed timeout from **${targetMember.user.tag}**. Reason: ${reason}`);
        } catch (error) {
            console.error(error);
            await ctx.reply("An error occurred while trying to untimeout the user.");
        }
    }
};

export default untimeout;
