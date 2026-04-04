# Command API 

This guide explains how to build commands for the Quinn bot using the defined TypeScript interfaces.

## Structure of a Command

A command is defined as an object that adheres to the `Command` interface exported in `src/types.ts`. To create a new command, simply create a new `.ts` file inside a category subdirectory within `src/commands` (e.g., `src/commands/utilities/ping.ts`).

The command struct must be the `default` export of the file.

### Required Properties

- `name` (`string`): The name of the command. This will be used as the slash command name and the prefix trigger.
- `description` (`string`): A straightforward description of what the command does. Required for slash commands.
- `execute` (`(ctx: Context) => Promise<void>`): The function containing the actual logic to be executed when the command is invoked. It takes a custom unified `Context` instance.

### Optional Properties

- `category` (`string`): This is automatically populated by the bot based on the directory the command file resides in (e.g., placing the file in `commands/admin/` sets the category to `ADMIN`).
- `options` (`Array`): An array of `ApplicationCommandOption` structs utilized heavily to register Discord Slash Command options. 
  - Represents arguments that can be passed to the command (e.g., `user`, `reason`).
- `conf` (`CommandConfig`): A configuration object applying constraints, validations, and behavioral rules to the command.

## `CommandConfig` Options

The validation system automatically enforces the constraints defined in `conf` prior to allowing `execute()` to run.

- `nsfwOnly` (`boolean`): If true, blocks execution in channels not marked as NSFW.
- `ownerOnly` (`boolean`): Restricts execution exclusively to the `OWNER_ID` defined in `.env`.
- `modOnly` (`boolean`): Requires the executing user to possess the `ManageGuild` permission.
- `allowedRoles` (`string[]`): Execution is allowed only if the user possesses at least one of these Role IDs.
- `disallowedRoles` (`string[]`): Explicitly blocks users with these Role IDs from execution.
- `allowPrefix` (`boolean`): (Optional flag design)
- `cooldown` (`{ time: number; limit: number }`): Prevents spam by restricting usage. Limits `limit` uses every `time` seconds per user.
- `requireHierarchy` (`boolean`): Used predominantly for moderation commands. Enforces that the issuer's highest role must be higher than the target user's highest role.

## Example Command

```typescript
import { Command } from "../../types";
import { ApplicationCommandOptionType } from "discord.js";

const kickUser: Command = {
    name: "kick",
    description: "Kicks a user from the server.",
    conf: {
        modOnly: true,
        requireHierarchy: true,
        cooldown: { time: 5, limit: 1 }
    },
    options: [
        {
            name: "target",
            description: "The user to kick",
            type: ApplicationCommandOptionType.User,
            required: true
        }
    ],
    async execute(ctx) {
        // Use ctx.args to parse target user via prefix
        // or interaction options for slash commands.
        await ctx.reply("User has been kicked (conceptually).");
    }
};

export default kickUser;
```
