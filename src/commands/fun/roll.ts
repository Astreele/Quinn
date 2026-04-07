import { ApplicationCommandOptionType, EmbedBuilder } from "discord.js";
import { Command } from "../../types";

const roll: Command = {
    name: "roll",
    description: "Roll dice notation or a custom number range.",
    options: [
        {
            name: "notation",
            description: "Dice notation like 2d6+4 or 4d6-1d4+2",
            type: ApplicationCommandOptionType.String,
            required: false
        },
        {
            name: "minimum",
            description: "The minimum value to roll",
            type: ApplicationCommandOptionType.Integer,
            required: false
        },
        {
            name: "maximum",
            description: "The maximum value to roll",
            type: ApplicationCommandOptionType.Integer,
            required: false
        }
    ],
    async execute(ctx) {
        const successColor = "Yellow";
        const errorColor = "Red";
        const notationInput =
            ctx.parseString("notation", 0, true)?.trim() ?? null;
        const firstNumber = ctx.parseInteger("minimum", notationInput ? 1 : 0);
        const secondNumber = ctx.parseInteger("maximum", notationInput ? 2 : 1);

        const createErrorEmbed = (message: string) =>
            new EmbedBuilder()
                .setColor(errorColor)
                .setTitle("Roll Error")
                .setDescription(message)
                .setFooter({ text: `Requested by ${ctx.author.username}` })
                .setTimestamp();

        const createSuccessEmbed = () =>
            new EmbedBuilder()
                .setColor(successColor)
                .setFooter({ text: `Rolled by ${ctx.author.username}` })
                .setTimestamp();

        const sendError = async (message: string) => {
            await ctx.reply({ embeds: [createErrorEmbed(message)] });
        };

        const rollDie = (sides: number) =>
            Math.floor(Math.random() * sides) + 1;

        const resolveRange = () => {
            if (
                !notationInput &&
                firstNumber === null &&
                secondNumber === null
            ) {
                return { minimum: 1, maximum: 6 };
            }

            if (
                notationInput &&
                /^-?\d+$/.test(notationInput) &&
                firstNumber === null &&
                secondNumber === null
            ) {
                const numericMaximum = Number.parseInt(notationInput, 10);

                if (numericMaximum < 1) {
                    return {
                        error: "The maximum roll must be at least 1."
                    };
                }

                return { minimum: 1, maximum: numericMaximum };
            }

            if (
                !notationInput &&
                firstNumber !== null &&
                secondNumber === null
            ) {
                if (firstNumber < 1) {
                    return {
                        error: "The maximum roll must be at least 1."
                    };
                }

                return { minimum: 1, maximum: firstNumber };
            }

            if (
                !notationInput &&
                firstNumber === null &&
                secondNumber !== null
            ) {
                return {
                    error: "Provide both minimum and maximum, or only a single maximum value."
                };
            }

            if (
                !notationInput &&
                firstNumber !== null &&
                secondNumber !== null
            ) {
                if (secondNumber < firstNumber) {
                    return {
                        error: "The maximum roll must be greater than or equal to the minimum."
                    };
                }

                return { minimum: firstNumber, maximum: secondNumber };
            }

            return null;
        };

        const range = resolveRange();

        if (range?.error) {
            await sendError(range.error);
            return;
        }

        if (range && "minimum" in range && "maximum" in range) {
            const minimum = range.minimum ?? 1;
            const maximum = range.maximum ?? 6;
            const result =
                Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;

            const embed = createSuccessEmbed()
                .setTitle("Dice Roll")
                .setDescription(`You rolled **${result}**.`)
                .addFields(
                    {
                        name: "Range",
                        value: `${minimum} to ${maximum}`,
                        inline: true
                    },
                    {
                        name: "Mode",
                        value: "Range",
                        inline: true
                    }
                );

            await ctx.reply({ embeds: [embed] });
            return;
        }

        if (!notationInput) {
            await sendError(
                "Provide dice notation like `2d6+4` or a valid range such as `1 20`."
            );
            return;
        }

        const notation = notationInput.replace(/\s+/g, "");
        const tokenPattern = /[+-]?(?:\d*d\d+|\d+)/g;
        const tokens = notation.match(tokenPattern) ?? [];

        if (tokens.length === 0 || tokens.join("") !== notation) {
            await sendError(
                "Invalid dice notation. Use formats like `d20`, `2d6+4`, or `4d6-1d4+2`."
            );
            return;
        }

        const rollDetails: string[] = [];
        let total = 0;
        let totalDice = 0;

        for (const token of tokens) {
            const sign = token.startsWith("-") ? -1 : 1;
            const unsignedToken = token.replace(/^[+-]/, "");

            if (unsignedToken.includes("d")) {
                const [countPart, sidesPart] = unsignedToken.split("d");
                const count =
                    countPart === "" ? 1 : Number.parseInt(countPart, 10);
                const sides = Number.parseInt(sidesPart, 10);

                if (!Number.isInteger(count) || count < 1) {
                    await sendError(
                        "Each dice term must roll at least one die."
                    );
                    return;
                }

                if (!Number.isInteger(sides) || sides < 2) {
                    await sendError("Each die must have at least 2 sides.");
                    return;
                }

                if (count > 100) {
                    await sendError(
                        "A single dice term cannot roll more than 100 dice."
                    );
                    return;
                }

                if (sides > 1000) {
                    await sendError(
                        "A single die cannot have more than 1000 sides."
                    );
                    return;
                }

                totalDice += count;

                if (totalDice > 200) {
                    await sendError(
                        "This roll is too large. Keep the total dice at 200 or fewer."
                    );
                    return;
                }

                const rolls = Array.from({ length: count }, () =>
                    rollDie(sides)
                );
                const subtotal =
                    rolls.reduce((sum, value) => sum + value, 0) * sign;
                total += subtotal;

                rollDetails.push(
                    `${sign === -1 ? "-" : "+"}${count}d${sides}: [${rolls.join(", ")}] = **${subtotal}**`
                );
            } else {
                const modifier = Number.parseInt(unsignedToken, 10) * sign;
                total += modifier;
                rollDetails.push(
                    `${modifier >= 0 ? "+" : ""}${modifier} modifier`
                );
            }
        }

        const embed = createSuccessEmbed()
            .setTitle("Dice Roll")
            .setDescription(`Notation: \`${notation}\`\nTotal: **${total}**`)
            .addFields(
                {
                    name: "Breakdown",
                    value: rollDetails.join("\n").slice(0, 1024)
                },
                {
                    name: "Dice Count",
                    value: `${totalDice}`,
                    inline: true
                },
                {
                    name: "Terms",
                    value: `${tokens.length}`,
                    inline: true
                }
            );

        await ctx.reply({ embeds: [embed] });
    }
};

export default roll;
