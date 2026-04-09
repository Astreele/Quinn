# Refactor Plan 03: Eliminate Redundant Code in Command Files

## Analysis

After thorough review of all command files, the following redundant patterns have been identified:

### 1. Embed Builder Boilerplate (HIGH PRIORITY)

**Files affected:** All command files
**Pattern:** Manual `EmbedBuilder` instantiation with repeated footer/timestamp

```typescript
// Found in: ban.ts, kick.ts, warnings.ts, serverinfo.ts, 8ball.ts, ping.ts
const embed = new EmbedBuilder()
  .setFooter({ text: `Requested by ${ctx.author.username}` })
  .setTimestamp()
  .setColor("Yellow"); // or "Red"
```

**Redundancy count:** ~6 files × 3-5 lines = **18-30 lines of duplicated code**

See: `refactor/01-better-embed-wrapping.md` for dedicated solution.

---

### 2. User Validation Pattern (MEDIUM PRIORITY)

**Files affected:** `ban.ts`, `kick.ts`, `warnings.ts`

**Redundant pattern:**
```typescript
// ban.ts
const targetUser = await ctx.parseUser("target", 0);
if (!targetUser) {
  const embed = new EmbedBuilder()
    .setFooter({ text: `Requested by ${ctx.author.username}` })
    .setTimestamp()
    .setColor("Red")
    .setTitle("Please specify a valid user.")
    .setDescription("Could not identify the user to ban.");
  await ctx.reply({ embeds: [embed] });
  return;
}

// kick.ts - Nearly identical
const targetMember = await ctx.parseMember("target", 0);
if (!targetMember) {
  const embed = new EmbedBuilder()
    .setFooter({ text: `Requested by ${ctx.author.username}` })
    .setTimestamp()
    .setColor("Red")
    .setTitle("Please specify a valid user.")
    .setDescription("Could not find that user in the server.");
  await ctx.reply({ embeds: [embed] });
  return;
}

// warnings.ts - Nearly identical
const targetMember = await ctx.parseMember("target", 0);
if (!targetMember) {
  const embed = new EmbedBuilder()
    .setFooter({ text: `Requested by ${ctx.author.username}` })
    .setTimestamp()
    .setColor("Red")
    .setTitle("Please specify a valid user.")
    .setDescription("Could not find that user in the server.");
  await ctx.reply({ embeds: [embed] });
  return;
}
```

**Problem:** Same validation + error response pattern repeated across moderation commands.

---

### 3. Permission/Hierarchy Checks (MEDIUM PRIORITY)

**Files affected:** `ban.ts`, `kick.ts`

**Redundant pattern:**
```typescript
// ban.ts
const member = await ctx.guild.members.fetch(targetUser.id).catch(() => null);
if (member && !member.bannable) {
  const embed = new EmbedBuilder()
    .setFooter({ text: `Requested by ${ctx.author.username}` })
    .setTimestamp()
    .setColor("Red")
    .setTitle("I do not have permission to kick this user.")
    .setDescription("Check my roles and permissions.");
  await ctx.reply({ embeds: [embed] });
  return;
}

// kick.ts
if (!targetMember.kickable) {
  const embed = new EmbedBuilder()
    .setFooter({ text: `Requested by ${ctx.author.username}` })
    .setTimestamp()
    .setColor("Red")
    .setTitle("I do not have permission to kick this user.")
    .setDescription("Check my roles and permissions.");
  await ctx.reply({ embeds: [embed] });
  return;
}
```

**Problem:** Bot permission checks with identical error embeds.

---

### 4. Error Handling Pattern (MEDIUM PRIORITY)

**Files affected:** `ban.ts`, `kick.ts`

**Redundant pattern:**
```typescript
// ban.ts
try {
  // ... action logic
} catch (error) {
  console.error(error);  // ← Inconsistent: sometimes console.error, sometimes logger
  embed.setDescription("An error occurred while trying to ban the user.");
  await ctx.reply({ embeds: [embed] });
}

// kick.ts - Nearly identical
try {
  // ... action logic
} catch (error) {
  console.error(error);
  embed.setDescription("An error occurred while trying to kick the user.");
  await ctx.reply({ embeds: [embed] });
}
```

**Problems:**
- Uses `console.error` instead of `logger` (inconsistent with rest of codebase)
- Error embed construction is duplicated
- Error messages could be centralized

---

### 5. DM Before Action Pattern (LOW PRIORITY)

**Files affected:** `ban.ts`, `kick.ts`

**Redundant pattern:**
```typescript
// Both files
embed
  .setTitle(`You have been banned/kicked from **${ctx.guild.name}**.`)
  .setDescription(`Reason: ${reason}`);
await targetUser.send({ embeds: [embed] }).catch(() => null);
```

**Problem:** Same DM pattern with minor variations.

---

### 6. Date Formatting Utility (LOW PRIORITY)

**Files affected:** `serverinfo.ts`

**Issue:** `formatDate` function is defined inline but could be useful for other commands.

---

## Proposed Solution

### 1. Create Moderation Command Helpers

**File:** `src/utils/moderationHelpers.ts`

```typescript
import { EmbedBuilder, GuildMember, User } from "discord.js";
import { Context, GuildContext } from "../types";
import { createErrorEmbed } from "./embedBuilder";

/**
 * Parse and validate a target user/member with automatic error response.
 * Returns null and sends error message if validation fails.
 */
export async function resolveTargetMember(
  ctx: GuildContext,
  optionName: string,
  position: number
): Promise<GuildMember | null>;

/**
 * Check if the bot has permission to perform an action on a member.
 * Returns false and sends error message if permission is lacking.
 */
export async function assertBotPermission(
  ctx: GuildContext,
  member: GuildMember,
  permission: "bannable" | "kickable" | "manageable"
): Promise<boolean>;

/**
 * Attempt to DM a user with an embed before taking action.
 * Silently fails if DMs are disabled.
 */
export async function dmUser(
  user: User,
  guildName: string,
  action: string,
  reason: string
): Promise<void>;

/**
 * Execute a moderation action with standardized error handling.
 */
export async function executeModerationAction(
  ctx: GuildContext,
  action: () => Promise<void>,
  actionName: string
): Promise<boolean>;
```

### 2. Create General Command Utilities

**File:** `src/utils/commandUtils.ts` (or expand existing files)

```typescript
/**
 * Standardized error response handler.
 */
export function sendErrorReply(
  ctx: Context,
  title: string,
  description?: string
): Promise<void>;

/**
 * Safe date formatter (extracted from serverinfo.ts).
 */
export function formatDate(date: Date, relative?: boolean): string;
```

### 3. Update Logger Usage

**Global change:** Replace all `console.error` with `logger.error` across command files for consistency.

---

## Implementation Steps

### Phase 1: Create Utility Files
1. Create `src/utils/embedBuilder.ts` (see Plan 01)
2. Create `src/utils/moderationHelpers.ts`
3. Create `src/utils/commandUtils.ts`

### Phase 2: Update Moderation Commands
1. **`ban.ts`**:
   - Replace user validation with `resolveTargetMember`
   - Replace permission check with `assertBotPermission`
   - Replace DM pattern with `dmUser`
   - Replace try/catch with `executeModerationAction`
   - Replace embed creation with factory functions

2. **`kick.ts`**:
   - Same refactoring as `ban.ts`

3. **`warnings.ts`**:
   - Replace user validation with `resolveTargetMember`
   - Replace embed creation with factory functions

### Phase 3: Update Utility Commands
1. **`ping.ts`**: Use embed factory
2. **`serverinfo.ts`**: 
   - Use embed factory
   - Extract `formatDate` to shared utility
3. **`8ball.ts`**: Use embed factory
4. **All other commands**: Use embed factory

### Phase 4: Verification
1. Run linter: `npm run lint`
2. Build project: `npm run build`
3. Test all commands manually
4. Verify no functionality regressions

---

## Expected Benefits

1. **Code reduction**: ~150-200 lines of duplicated code removed
2. **Consistency**: All commands use same patterns and error handling
3. **Maintainability**: Changes to error handling or embed styling in one place
4. **Readability**: Command files focus on business logic, not boilerplate
5. **Testability**: Utility functions can be unit tested independently

---

## Files to Modify

### New Files
- `src/utils/embedBuilder.ts`
- `src/utils/moderationHelpers.ts`
- `src/utils/commandUtils.ts`

### Modified Files
- `src/commands/moderation/ban.ts`
- `src/commands/moderation/kick.ts`
- `src/commands/moderation/warn.ts`
- `src/commands/moderation/warnings.ts`
- `src/commands/moderation/unban.ts`
- `src/commands/moderation/timeout.ts`
- `src/commands/moderation/untimeout.ts`
- `src/commands/moderation/lock.ts`
- `src/commands/moderation/unlock.ts`
- `src/commands/moderation/clear.ts`
- `src/commands/utilities/ping.ts`
- `src/commands/utilities/serverinfo.ts`
- `src/commands/utilities/whois.ts`
- `src/commands/utilities/uptime.ts`
- `src/commands/utilities/stats.ts`
- `src/commands/utilities/avatar.ts`
- `src/commands/fun/8ball.ts`
- `src/commands/fun/coinflip.ts`
- `src/commands/fun/roll.ts`
- `src/commands/admin/reload.ts`

---

## Risk Assessment

- **Low risk**: Most changes are cosmetic refactoring
- **Testing required**: All commands must be tested after refactoring
- **Backwards compatible**: No changes to public API or command behavior
- **Rollback plan**: All changes preserve original logic, only extraction to utilities
