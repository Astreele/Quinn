# Quinn Discord Bot Developer Documentation

Welcome to the development documentation for the Quinn bot, a TypeScript-based framework tailored for building Discord bots with seamless dual support for Prefix commands and modern Slash (Interaction) commands via Discord.js.

## Getting Started

### Environment Variables

Before running the bot, ensure you create a `.env` file at the root of the project mirroring the variables below:

```env
# Critical connection token for your bot application
DISCORD_TOKEN=your_bot_token_here

# The string used to invoke standard message commands (e.g. $, !, ?)
PREFX=$

# Discord ID of the bot owner/operator. Granted bypasses and ownerOnly command access.
OWNER_ID=your_user_id

# Set to "true" to register slash commands instantly to a specific guild during development
USE_TEST_GUILD=true

# The Guild ID to register slash commands to when USE_TEST_GUILD is true
TEST_GUILD_ID=your_test_server_id
```

## Documentation Reference 

Please visit the corresponding documentation modules below to understand core architectures and how to build components:

- [Architecture Overview](architecture.md): High-level description detailing execution flow, validation routing, and core structure.
- [Context API Reference](context_api.md): Learn about the `Context` class, an abstraction layer that unifies `Message` and `Interaction` handling.
- [Command API Reference](command_api.md): Discover how to create commands and apply powerful constraint limits via `CommandConfig`.

## Quick Context

The project code is primarily housed within the `/src` directory:
- `/src/index.ts` is the initialization footprint.
- `/src/commands/` holds automated directories mapping to different bot commands.
