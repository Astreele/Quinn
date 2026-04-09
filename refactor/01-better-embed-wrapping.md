# Refactor Plan 01: Better Embed Wrapping with Convenient Naming

## Analysis

### Current State
After reviewing the command files, **every command that produces output manually instantiates `EmbedBuilder`** and repeats common patterns:

**Redundant patterns found across multiple files:**
```typescript
const embed = new EmbedBuilder()
  .setFooter({ text: `Requested by ${ctx.author.username}` })
  .setTimestamp()
  .setColor("Yellow");  // or "Red" for errors
```

This pattern appears in:
- `src/commands/moderation/ban.ts`
- `src/commands/moderation/kick.ts`
- `src/commands/moderation/warnings.ts`
- `src/commands/utilities/ping.ts`
- `src/commands/utilities/serverinfo.ts`
- `src/commands/fun/8ball.ts`

### Problems Identified

1. **Repetitive boilerplate**: Every command manually sets footer, timestamp, and color
2. **Inconsistent error handling**: Error embeds are built inline with mixed color usage
3. **No centralized embed factory**: No reusable utilities for common embed patterns
4. **Manual field building**: Responses are constructed imperatively rather than through helpers

## Proposed Solution

### Create an Embed Factory Utility

Create `src/utils/embedBuilder.ts` with the following API:

```typescript
import { EmbedBuilder, ColorResolvable } from "discord.js";
import { Context } from "../context";

/**
 * Creates a standard success/info embed with automatic footer and timestamp.
 */
export function createInfoEmbed(
  ctx: Context,
  title: string,
  color: ColorResolvable = "Yellow"
): EmbedBuilder;

/**
 * Creates a standard error embed with red color.
 */
export function createErrorEmbed(
  ctx: Context,
  title: string,
  description?: string
): EmbedBuilder;

/**
 * Creates a success embed with green color.
 */
export function createSuccessEmbed(
  ctx: Context,
  title: string,
  description?: string
): EmbedBuilder;

/**
 * Creates a warning embed with orange color.
 */
export function createWarningEmbed(
  ctx: Context,
  title: string,
  description?: string
): EmbedBuilder;

/**
 * Builder helper for moderation actions (ban/kick/warn/etc).
 * Provides consistent formatting for action results.
 */
export function createActionEmbed(
  ctx: Context,
  action: string,
  target: string,
  reason: string,
  success: boolean
): EmbedBuilder;
```

### Implementation Steps

1. **Create `src/utils/embedBuilder.ts`** with the factory functions
2. **Update existing commands** to use the new helpers:
   - `src/commands/moderation/ban.ts`
   - `src/commands/moderation/kick.ts`
   - `src/commands/moderation/warnings.ts`
   - `src/commands/utilities/ping.ts`
   - `src/commands/utilities/serverinfo.ts`
   - `src/commands/fun/8ball.ts`
   - All other command files
3. **Update documentation** in `docs/command_api.md` to reference the new utilities

### Expected Benefits

- **Reduced code duplication**: ~10-15 lines removed per command file
- **Consistent styling**: All embeds will have uniform footer, timestamp, and color patterns
- **Easier maintenance**: Change embed styling in one place
- **Better readability**: Command logic focuses on business logic, not embed construction

### Example Before/After

**Before (ban.ts):**
```typescript
const embed = new EmbedBuilder()
  .setFooter({ text: `Requested by ${ctx.author.username}` })
  .setTimestamp()
  .setColor("Red");

if (!targetUser) {
  embed
    .setTitle("Please specify a valid user.")
    .setDescription("Could not identify the user to ban.");
  await ctx.reply({ embeds: [embed] });
  return;
}
```

**After (ban.ts):**
```typescript
if (!targetUser) {
  const embed = createErrorEmbed(ctx, "Please specify a valid user.", 
    "Could not identify the user to ban.");
  await ctx.reply({ embeds: [embed] });
  return;
}
```
