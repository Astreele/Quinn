import { ApplicationCommandOptionType } from "discord.js";
import { GuildCommand } from "../../types";

const unban: GuildCommand = {
    name: "unban",
    description: "Revokes a ban on a user.",
    category: "moderation",
    conf: {
        modOnly: true,
        guildOnly: true,
    },
    options: [
        {
            name: "userid",
            description: "The ID of the user to unban",
            type: ApplicationCommandOptionType.String,
            required: true,
        },
        {
            name: "reason",
            description: "The reason for unbanning the user",
            type: ApplicationCommandOptionType.String,
            required: false,
        }
    ],
    async execute(ctx) {
        const targetId = ctx.parseString("userid", 0);
        const reason = ctx.parseString("reason", 1, true) || "No reason provided.";

        if (!targetId) {
            await ctx.reply("Please specify a valid user ID to unban.");
            return;
        }

        // Defer here because fetching bans can take longer than 3 seconds on large servers
        await ctx.defer();

        try {
            // Attempt to fetch the specific ban rather than the entire guild's ban list
            const ban = await ctx.guild.bans.fetch(targetId).catch(() => null);
            if (!ban) {
                await ctx.reply("That user is not currently banned.");
                return;
            }

            await ctx.guild.members.unban(targetId, reason);
            await ctx.reply(`Successfully unbanned user with ID **${targetId}**. Reason: ${reason}`);
        } catch (error) {
            console.error(error);
            await ctx.reply("An error occurred while trying to unban the user. Ensure the ID is valid.");
        }
    }
};

export default unban;
