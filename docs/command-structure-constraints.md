# Command Structure Constraints - Technical Documentation

## Overview

This document describes the **Discord API constraints** enforced by the command loader and how they impact your filesystem structure.

**Note:** Category folders (`admin/`, `moderation/`, `fun/`, `utilities/`) are **transparent** — they exist ONLY for developer organization and are **NOT part of the command path**. All categories merge into one flat command namespace.

**Cross-category group merging:** If the same group folder name exists in multiple categories, they are merged into a single group. For example:
```
src/commands/utilities/user/avatar.ts   → /user avatar
src/commands/moderation/user/ban.ts     → /user ban
```
Both become subcommands of the same `/user` group. Subcommand names within a merged group must still be unique across all categories.

---

## The Constraints

### Constraint 1: Maximum 2 Levels of Nesting

**Discord API Limit:**
```
/command                    ← Level 0: Root command
/command subcommand         ← Level 1: Subcommand
/command group subcommand   ← Level 2: SubcommandGroup → Subcommand
```

**No deeper nesting is allowed.**

**Filesystem Enforcement:**
```
src/commands/moderation/          ← category (transparent, not part of path)
  ban.ts                          ← /ban ✅
  channel/                        ← group
    lock.ts                       ← /channel lock ✅
    sub/                          ← subgroup ❌ TOO DEEP
      lock.ts                     ← Would be depth 3
```

**Max depth:** `group → subcommand` (2 levels from the category root)

---

### Constraint 2: No Mixing Flat Subcommands with Groups (Within a Group)

**Discord API Rule:**
A command group must be **EITHER**:
- All flat subcommands (Level 1 only)
- All subcommand groups (Level 2)

**Cannot mix both at the same level within a group.**

**Note:** At depth 0 (the root command level), flat commands and groups CAN coexist, because each top-level entry is an independent Discord application command. The "no mixing" rule applies only to subcommands *within* a single command/group.

**Filesystem Enforcement:**

❌ **INVALID** - Mixing within a group:
```
src/commands/moderation/channel/
  lock.ts         ← Flat subcommand (file)
  unlock.ts       ← Flat subcommand (file)
  sub/            ← Subcommand group (folder) ❌ MIXING!
    something.ts
```

✅ **VALID** - All flat within the group:
```
src/commands/moderation/channel/
  lock.ts         ← /channel lock
  unlock.ts       ← /channel unlock
```

✅ **VALID** - All grouped within the group:
```
src/commands/moderation/channel/
  text/
    lock.ts       ← /channel text lock
  voice/
    lock.ts       ← /channel voice lock
```

✅ **VALID** - Flat commands and groups at root (categories merge):
```
src/commands/
  moderation/
    ban.ts              ← /ban
    channel/
      lock.ts           ← /channel lock
  utilities/
    ping.ts             ← /ping
    bot/
      stats.ts          ← /bot stats
```

---

## Why These Constraints?

### 1. Discord API Validation

If you try to register commands that violate these rules, Discord's API will reject them with errors like:
```
Invalid Form Body
options[0].type: This field is required
```

### 2. Fail Fast with Clear Messages

Instead of waiting for Discord to reject commands, we validate **during the build process** and provide **detailed error messages** explaining exactly what's wrong and how to fix it.

### 3. Consistency Across All Command Types

**Both prefix and slash commands follow the same constraints:**
- Maximum 2 levels of nesting
- Same structure rules
- Same validation enforcement

This ensures:
- Predictable command organization
- Consistent user experience (prefix and slash behave identically)
- Alignment with Discord's design patterns
- No confusion about what's allowed in different contexts

---

## Validation Implementation

### Where It Happens

**File:** `src/handlers/commands.ts`

**Function:** `validateCommandStructure()`

**Called:** During `buildCommandTree()` **BEFORE** processing files/folders

### What It Checks

```typescript
// Check 1: No mixing files and folders
if (hasFiles && hasFolders) {
  throw new Error("...detailed message...");
}

// Check 2: Max depth of 2 levels
if (depth > 2) {
  throw new Error("...detailed message...");
}

// Check 3: Depth 2 cannot have folders (would be depth 3)
if (depth === 2 && hasFolders) {
  throw new Error("...detailed message...");
}
```

### Error Messages

Errors include:
- **Which command** has the violation
- **What files/folders** are problematic
- **Why** it's invalid
- **How to fix it** with specific examples

**Example Error:**
```
Failed to load commands in category "moderation":
Command structure violation: "moderation" mixes flat subcommands with subcommand groups.
Discord API requires commands to be EITHER all flat subcommands OR all subcommand groups.

Files found: ban.ts, kick.ts
Folders found: user/

To fix this:
  Option 1: Move all files into a subfolder to create a flat structure:
    moderation/ → moderation/_default.ts (if needed) + files as subcommands
  Option 2: Move all files into a subfolder like "general/" to make everything grouped:
    moderation/general/ban.ts, moderation/general/kick.ts, etc.
```

---

## Valid Structure Examples

### Example 1: Simple Flat Commands (in any category)

```
src/commands/utilities/ping.ts       → /ping
src/commands/utilities/uptime.ts     → /uptime
src/commands/fun/roll.ts             → /roll
```

**Result:** All flat root commands (depth 0)

---

### Example 2: Grouped Structure (in any category)

```
src/commands/moderation/
  channel/
    lock.ts         → /channel lock
    unlock.ts       → /channel unlock
src/commands/utilities/
  bot/
    ping.ts         → /bot ping
    stats.ts        → /bot stats
```

**Result:** All subcommand groups (depth 1 → depth 2)

---

### Example 3: Mixed Root Level — Flat Commands + Groups (Valid!)

```
src/commands/
  fun/
    roll.ts         → /roll (flat root command)
    8ball.ts        → /8ball (flat root command)
  moderation/
    ban.ts          → /ban (flat root command)
    channel/        → /channel ... (group)
      lock.ts       → /channel lock
      unlock.ts     → /channel unlock
  utilities/
    ping.ts         → /ping (flat root command)
    bot/            → /bot ... (group)
      stats.ts      → /bot stats
      uptime.ts     → /bot uptime
```

**Result:** ✅ Valid! Flat commands and groups coexist at root level because categories are transparent.

---

## Invalid Structure Examples

### Example 1: Mixed Structure Within a Group (Will Fail)

```
src/commands/moderation/channel/
  lock.ts           ← File (flat subcommand)
  unlock.ts         ← File (flat subcommand)
  sub/              ← Folder (subcommand group) ❌ ERROR!
    something.ts
```

**Error:** "mixes flat subcommands with subcommand groups"

**Fix:** Choose one structure:
- All flat: Remove `sub/` folder, keep only files
- All grouped: Move `lock.ts` and `unlock.ts` into their own subfolder

---

### Example 2: Too Deep (Will Fail)

```
src/commands/moderation/admin/
  user/
    perm/           ← Depth 2 (group within group)
      ban.ts        ← Depth 3 ❌ ERROR!
```

**Error:** "exceeds maximum nesting depth"

**Fix:** Flatten to max 2 levels:
```
src/commands/moderation/admin/
  user/
    ban.ts          ← Depth 2 ✅
```

---

## How Commands Are Resolved

### Prefix Commands (Message-based)

**Maximum depth: 2 levels (same as slash commands)**

```typescript
// Input: !channel lock
// Resolution:
// 1. Get root: client.commands.get("channel")
// 2. Traverse: channel._children.get("lock")      [depth 1]
// 3. Execute: lock.execute(ctx)
```

**Resolution stops at depth 2:**
```typescript
// If user tries: !group subgroup subsub sub
// 1. Get root: "group"
// 2. Traverse: subgroup                             [depth 1]
// 3. Traverse: subsub                               [depth 2 - MAX]
// 4. STOPS - "sub" becomes remaining args, not traversed
// Result: Executes "subsub" command with ["sub"] as args
```

### Slash Commands (Interaction-based)

**Maximum depth: 2 levels (Discord API limit)**

```typescript
// Input: /channel lock
// Resolution:
// 1. interaction.commandName = "channel"
// 2. interaction.options.getSubcommand() = "lock"
// 3. Traverse: channel._children.get("lock")
// 4. Execute: lock.execute(ctx)
```

```typescript
// Input: /group subgroup subcommand
// Resolution:
// 1. interaction.commandName = "group"
// 2. interaction.options.getSubcommandGroup() = "subgroup"
// 3. interaction.options.getSubcommand() = "subcommand"
// 4. Traverse: group._children.get("subgroup")._children.get("subcommand")
// 5. Execute: subcommand.execute(ctx)
```

---

## Default Files

Special file names that become a group's default execution:

- `_default.ts` (recommended)
- `_default.js`
- `_index.ts`
- `_index.js`

**Example:**
```
src/commands/moderation/
  user/
    _default.ts     → /moderation user (runs this file)
    ban.ts          → /moderation user ban
```

If `_default.ts` exists, running `/moderation user` without a subcommand executes `_default.ts`.

---

## Build Process Flow

```
┌──────────────────────────────────────────────────────┐
│ 1. loadCommands() called                             │
│    - Scans all category dirs in src/commands/        │
│    - Categories are transparent, merged at root       │
└──────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────┐
│ 2. Aggregate depth-0 entries across all categories   │
│    - Collect all command files                       │
│    - Collect all group folders                        │
│    - Check for duplicate names across categories      │
└──────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────┐
│ 3. validateCommandStructure() on MERGED root         │
│    ✅ Check: Depth 0 allows flat + groups (root)     │
│    ✅ Check: Depth > 0 no mixing files + folders     │
│    ✅ Check: Depth ≤ 2                               │
│    ❌ If any fail → Throw detailed error             │
└──────────────────────────────────────────────────────┘
                        ↓ (if valid)
┌──────────────────────────────────────────────────────┐
│ 4. Process files → Commands                          │
│    - Load module                                     │
│    - Validate has execute()                          │
│    - Add to merged tree Map                          │
└──────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────┐
│ 5. Process folders → Command Groups                  │
│    - Recursively call buildCommandTree()             │
│    - Creates group Command with _children            │
│    - Attaches _default.ts if exists                  │
└──────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────┐
│ 6. Register in client.commands                       │
│    - client.commands.set(name, command)              │
└──────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────┐
│ 7. buildSlashCommandData()                           │
│    - Tree already validated, safe to build options   │
│    - Flat children → Subcommand type                 │
│    - Groups → SubcommandGroup type                   │
└──────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────┐
│ 8. REST.put() → Discord API                          │
│    - Commands registered successfully                │
│    - Guaranteed valid structure                      │
└──────────────────────────────────────────────────────┘
```

---

## Troubleshooting

### "mixes flat subcommands with subcommand groups"

**Cause:** You have both `.ts` files and folders inside the same *group* directory (not at root).

**Fix:** Choose one structure within the group:
- **All flat:** Move folders' contents up, delete folders
- **All grouped:** Move files into a subfolder (e.g., `general/`)

### "exceeds maximum nesting depth"

**Cause:** Your folder structure is more than 2 levels deep from the category root.

**Fix:** Flatten the structure to max 2 folder levels.

### "must define an execute() function"

**Cause:** A command file doesn't have an `execute` function.

**Fix:** Add `async execute(ctx) { ... }` to the command, or if it's meant to be a group folder, ensure it has a `_default.ts` file.

### "Duplicate command name"

**Cause:** Two files in different category folders export a command with the same name.

**Fix:** Rename one of the commands so all command names are unique across all categories.

---

## Migration Guide

### From Old Subcommand Arrays

**Before:**
```typescript
const moderation: Command = {
  name: "moderation",
  subcommands: [
    { name: "ban", description: "...", execute: ... },
    { name: "kick", description: "...", execute: ... },
  ],
};
```

**After:**
```
src/commands/moderation/
  ban.ts
  kick.ts
```

Each file exports:
```typescript
import { GuildCommand } from "../../types";

const ban: GuildCommand = {
  name: "ban",
  description: "Ban a user",
  async execute(ctx) { ... },
};

export default ban;
```

### From Category-Based Paths to Flat Namespace

**Before (category was part of path):**
```
src/commands/moderation/ban.ts   → /moderation ban
src/commands/utilities/ping.ts   → /utilities ping
```

**After (categories are transparent):**
```
src/commands/moderation/ban.ts   → /ban
src/commands/utilities/ping.ts   → /ping
```

---

## Summary

| Constraint | Rule | Why | Enforced When |
|------------|------|-----|---------------|
| Max Depth | 2 levels within a group | Discord API limit + consistency | Build time + Runtime |
| No Mixing | All flat OR all groups (within a group) | Discord API requirement | Build time |
| Root Level | Flat commands + groups CAN coexist | Each is an independent Discord command | Build time |
| Categories | Transparent, merged at root | Developer organization only | Build time |
| Valid Files | Must have execute() | Runnable commands | Build time |
| Valid Names | Must define name | Command identification | Build time |

**Benefits:**
- ✅ Fail fast with clear errors
- ✅ No surprise Discord API rejections
- ✅ Consistent command structure across prefix and slash
- ✅ Categories for organization without path pollution
- ✅ Easy to understand and maintain
- ✅ Both command types behave identically (max 2 levels within a group)
