import { ApplicationCommandOptionType, EmbedBuilder } from "discord.js";
import { Command } from "../../types";

const eightBall: Command = {
    name: "8ball",
    description: "Answers a yes or no question.",
    options: [
        {
            name: "question",
            description: "The yes or no question to ask",
            type: ApplicationCommandOptionType.String,
            required: true
        }
    ],
    async execute(ctx) {
        const responses = [
            "It is certain.",
            "It is decidedly so.",
            "Without a doubt.",
            "Yes, definitely.",
            "You may rely on it.",
            "As I see it, yes.",
            "Most likely.",
            "Outlook good.",
            "Yes.",
            "Signs point to yes.",
            "Reply hazy, try again.",
            "Ask again later.",
            "Better not tell you now.",
            "Cannot predict now.",
            "Concentrate and ask again.",
            "Don't count on it.",
            "My reply is no.",
            "My sources say no.",
            "Outlook not so good.",
            "Very doubtful."
        ];
        const question = ctx.parseString("question", 0, true)?.trim();
        const embed = new EmbedBuilder()
            .setColor("Yellow")
            .setFooter({ text: `Requested by ${ctx.author.username}` })
            .setTimestamp();

        if (!question) {
            embed
                .setColor("Red")
                .setTitle("8Ball Error")
                .setDescription("Ask a yes or no question to use the 8ball.");

            await ctx.reply({ embeds: [embed] });
            return;
        }

        const answer = responses[Math.floor(Math.random() * responses.length)];

        embed.setTitle("Magic 8-Ball").addFields(
            {
                name: "Question",
                value: question
            },
            {
                name: "Answer",
                value: answer
            }
        );
        await ctx.reply({ embeds: [embed] });
    }
};

export default eightBall;
