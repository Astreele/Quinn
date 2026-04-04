# Context API Reference

The `Context` class, found in `src/context.ts`, is one of the most vital components of the Quinn bot architecture.

## Overview

When a user executes a command via a traditional prefix (e.g., `$ping`) or via a Discord Slash-Command (`/ping`), they trigger entirely different objects in Discord.js (`Message` vs. `ChatInputCommandInteraction`).

The `Context` class serves as a universal wrapper, reconciling the discrepancies between these two objects. By abstracting the trigger type, command developers only need to write `execute()` logic *once*.

## Properties

*   `isInteraction` (`boolean`): Returns `true` if the command was triggered via a slash command.
*   `interaction?` (`ChatInputCommandInteraction`): The raw interaction object. Exists only if `isInteraction` is true.
*   `message?` (`Message`): The raw message object. Exists only if `isInteraction` is false.
*   `args` (`string[]`): An array of string arguments parsed from the prefix command input.

## Getters

These accessors safely fetch data, dynamically mapping under-the-hood to the correct source (`Interaction` or `Message`).

*   `author` (`User`): The user who invoked the command.
*   `member` (`GuildMember | null`): The guild member object of the invoker.
*   `guild` (`Guild | null`): The guild (server) where the command was issued.
*   `channel` (`TextBasedChannel | null`): The channel where the command was issued.
*   `client` (`Client`): The Discord.js client instances.
*   `createdTimestamp` (`number`): The UNIX timestamp of when the command was issued.

## Methods

### `reply(content: any, options?: { ephemeral?: boolean }): Promise<Message>`

The standard method to send a response to the user.
- Handles logic to intelligently `.editReply()` or `.followUp()` on Interactions if a deferral or reply has already occurred.
- Intelligently translates the `ephemeral` setting as an ephemeral message for Interactions, while automatically stripping it for regular Messages (since Messages do not natively support ephemerality).

### `editReply(content: any): Promise<Message>`

Edits the response previously sent by `reply()`.
- Throws an Error if used before interacting (requires a prior defer or reply).

### `getAttachment(optionName: string = "image"): Promise<Attachment | null>`

A convenience method designed to fetch user-uploaded attachments safely across execution contexts.
- **For Interactions**: It retrieves an attachment uploaded to the slash command using the `optionName` argument.
- **For Messages**: It checks if the message itself contains an attachment. If none are found, it checks if the invoking message was *replying* to a message that contained an attachment.
