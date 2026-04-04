# Architecture Overview

This document provides a high-level overview of the Quinn Discord bot's architecture.

## Execution Flow

1.  **Initialization**: The bot starts at `src/index.ts`. It loads environment variables, ensures required ones like `DISCORD_TOKEN` exist, and initializes the Discord.js `Client` with required intents (Guilds, GuildMessages, MessageContent).
2.  **Command Loading**: The system dynamically loads all commands from the `src/commands` subdirectories. It instantiates commands, assigns their category based on the directory name, and registers them in a `Collection`.
3.  **Command Registration**: When the `clientReady` event fires, the bot registers slash commands via the Discord REST API globally or, if configured, to a specific testing guild.
4.  **Message / Interaction Handling**:
    *   **Prefix Commands**: The `messageCreate` event listener checks if a message starts with the prefix and resolves the requested command.
    *   **Slash Commands**: The `interactionCreate` event listener resolves the invoked slash command.
5.  **Validation**: Before execution, both prefixes and interactions go through `runValidation()`. This applies constraints like cooldowns, owner-only limits, role boundaries, hierarchy checks, and NSFW checks as defined by the command's `CommandConfig`.
6.  **Context Creation**: The bot wraps the Discord `Message` or `ChatInputCommandInteraction` inside a custom `Context` object.
7.  **Command Execution**: The command's `execute(ctx)` method is invoked with the `Context`, ensuring standard behavior across both trigger types.

## File Structure

-   `src/index.ts`: The main entry point. Sets up the client, loads commands, manages command registration, handles bot events (`messageCreate` and `interactionCreate`), and performs core validation.
-   `src/context.ts`: Defines the `Context` class, which abstracts away the differences between a text message and a slash command interaction so command developers can write unified response logic.
-   `src/types.ts`: Core type definitions for the bot, mainly defining how a `Command` and its `CommandConfig` should be structured.
-   `src/commands/`: A directory populated with subdirectories representing command categories (e.g., `utilities`). Every TypeScript file inside these subdirectories is treating as a command.

## Validation Layer

The bot implements a robust validation layer before any command logic runs. 
Located in `index.ts` within the `runValidation` function, it intercepts command calls to ensure:

-   **Owner Only**: Restricts commands to the developer ID configured in `.env`.
-   **NSFW Check**: Prevents non-safe commands from running in normal channels.
-   **Moderation Permissions**: Hard requires the `ManageGuild` permission for certain commands.
-   **Role Limits**: Only allows the command if the user has specific predefined roles.
-   **Hierarchy Checks**: Prevents moderation of users with higher or equivalent roles to the issuer.
-   **Cooldowns**: Manages rate-limiting per user per command to prevent spam.
