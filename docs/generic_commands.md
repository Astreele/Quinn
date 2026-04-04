# Generic Bot Commands

Here is a comprehensive list of standard commands that every typical Discord bot should ideally implement, categorized by their primary function:

## 🛡️ Moderation
These commands are essential for server administrators and moderators to keep the community safe and clean.
- **`kick`**: Kicks a specified user from the server.
- **`ban`**: Bans a specified user from the server.
- **`unban`**: Revokes a ban on a user.
- **`timeout` / `mute`**: Temporarily stops a user from sending messages or joining voice channels.
- **`untimeout` / `unmute`**: Removes a timeout from a user.
- **`warn`**: Issues a formal warning to a user (often logged in a database).
- **`warnings`**: Displays a list of previous warnings for a specific user.
- **`clear` / `purge`**: Deletes a specified number of consecutive messages in a channel.
- **`lock` / `unlock`**: Locks down a channel, preventing regular members from sending messages.

## 🛠️ Utility & Information
Commands that provide useful information about the server, the bot, or the users.
- **`ping`**: Checks the bot's latency and API response time. *(Already partially implemented in your project)*
- **`help`**: Displays a list of available commands or detailed information about a specific command.
- **`userinfo` / `whois`**: Displays detailed statistics about a user (join date, account creation date, roles, ID, etc.).
- **`serverinfo`**: Displays detailed information about the current server (member count, creation date, boost level, etc.).
- **`avatar`**: Fetches and enlarges a user's profile picture.
- **`botinfo` / `stats`**: Shows the bot's uptime, memory usage, server count, and library versions.

## ⚙️ Configuration & Setup
Commands used by server admins to customize how the bot operates in their specific server.
- **`settings` / `config`**: Views or changes the bot's settings for the server.
- **`setlogchannel`**: Specifies a channel where all moderation actions (kicks, bans, deleted messages) will be automatically logged.
- **`setprefix`**: Changes the text/custom prefix if the bot doesn't exclusively use Slash Commands.

## 🎉 Fun & Miscellaneous (Optional but Common)
Standard interactive commands to keep users engaged.
- **`8ball`**: Answers a yes/no question randomly.
- **`coinflip`**: Flips a two-sided coin.
- **`roll` / `dice`**: Rolls a virtual die (e.g., a standard D6 or custom ranges).
