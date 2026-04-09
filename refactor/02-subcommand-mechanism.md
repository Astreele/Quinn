# Refactor Plan 02: Improved Subcommand Mechanism

## Analysis

### Current State

The current subcommand implementation has several limitations:

1. **Subcommands are defined as arrays** within the parent command file (`Command.subcommands?: Subcommand[]`)
2. **All subcommands live in one file** - the parent command file contains the `subcommands` array
3. **Single depth only** - Subcommands cannot have nested subcommands
4. **Type coupling** - The `Subcommand` type in `types.ts` is nearly identical to `Command`, creating redundancy
5. **Manual resolution** - `commandResolver.ts` must manually search through arrays to find subcommands

**Current structure:**
```
src/commands/moderation/
  warnings.ts        (standalone command)
  warn.ts            (standalone command)
```

**What subcommands would look like currently (hypothetical):**
```typescript
// moderation.ts - everything in ONE file
const moderation: Command = {
  name: "moderation",
  subcommands: [
    { name: "ban", execute: ... },
    { name: "kick", execute: ... },
    { name: "warn", execute: ... },
  ]
}
```

### Problems Identified

1. **Scalability**: All subcommands in one file becomes unmanageable
2. **No nesting**: Cannot have `/moderation ban` with `/moderation ban list` as a sub-subcommand
3. **Type redundancy**: `Subcommand` and `Command` interfaces share most properties
4. **Registration complexity**: `buildSlashCommandData` must manually map subcommand arrays
5. **File organization**: Cannot organize subcommands into their own files/folders

## Proposed Solution

### File-Based Subcommand Resolution with Unlimited Depth

Replace the `subcommands` array approach with a **file-system-driven** mechanism where:

1. **Folder = Command Group**: A folder can represent a command with subcommands
2. **`_default.ts` (or `_index.ts`)** = Default execution when no subcommand is specified
3. **Nested folders** = Nested subcommands with unlimited depth
4. **Automatic registration**: The loader recursively scans and builds the command tree

### Proposed Directory Structure

```
src/commands/
  moderation/
    _default.ts           # /moderation (default behavior)
    ban.ts                # /moderation ban
    kick.ts               # /moderation kick
    warn.ts               # /moderation warn
    warnings/
      _default.ts         # /moderation warnings (default)
      list.ts             # /moderation warnings list
      clear.ts            # /moderation warnings clear
  utilities/
    _default.ts           # /utilities
    whois.ts              # /utilities whois
    serverinfo.ts         # /utilities serverinfo
```

### How It Works

1. **Loader scans recursively**: `loadCommands` traverses the folder tree
2. **Automatic grouping**: Files in a folder become subcommands of the parent
3. **Default file**: `_default.ts` executes when the parent command is called without a subcommand
4. **Slash command registration**: Builds the nested option structure automatically for Discord API
5. **Resolution**: `commandResolver` traverses the tree based on the subcommand path

### Updated Type System

**Remove the `Subcommand` interface entirely** and unify on `Command`:

```typescript
// In types.ts - REMOVE this:
export interface Subcommand { ... }

// Everything becomes Command
export interface Command {
  name: string;
  description: string;
  category?: string;
  options?: CommandOption[];
  conf?: CommandConfig;
  execute?: (ctx: Context) => Promise<void>;
  
  // NEW: internal tree structure (auto-populated, not manually set)
  _children?: Map<string, Command>;  // subcommands
  _isGroup?: boolean;                 // is this a command group (folder)?
}
```

### Implementation Steps

#### Step 1: Update Type Definitions
- **File**: `src/types.ts`
- **Actions**:
  - Remove `Subcommand` interface
  - Add `_children?: Map<string, Command>` to `Command`
  - Add `_isGroup?: boolean` to `Command`
  - Update `GuildCommand` accordingly

#### Step 2: Rewrite Command Loader
- **File**: `src/handlers/commands.ts`
- **Actions**:
  - Replace flat folder scan with recursive traversal
  - Detect `_default.ts` in folders for default behavior
  - Build command tree with parent-child relationships
  - Auto-populate `_children` and `_isGroup`

#### Step 3: Update Slash Command Data Builder
- **File**: `src/handlers/commands.ts`
- **Actions**:
  - Rewrite `buildSlashCommandData` to handle nested structures
  - Use `ApplicationCommandOptionType.SubcommandGroup` for nested groups
  - Recursively build options tree

#### Step 4: Rewrite Command Resolver
- **File**: `src/utils/commandResolver.ts`
- **Actions**:
  - Update `resolveMessageCommand` to traverse the tree
  - Update `resolveInteractionCommand` to handle subcommand groups
  - Return the deepest matching command with full path context

#### Step 5: Update Event Handlers
- **File**: `src/events/interactionCreate.ts`
- **File**: `src/events/messageCreate.ts`
- **Actions**:
  - Update context creation to handle nested subcommand paths
  - Update logging to show full command path

#### Step 6: Migrate Existing Commands
- **Actions**:
  - Create `_default.ts` files where needed
  - Move subcommand-capable commands into folder structures
  - Test all commands work correctly

### Resolution Algorithm

**For slash commands (`/moderation ban`):**
```
1. interaction.commandName = "moderation"
2. interaction.options.getSubcommand(false) = "ban"
3. Traverse: commands.get("moderation")._children.get("ban")
4. Execute matched command
```

**For nested (`/moderation warnings list`):**
```
1. interaction.commandName = "moderation"
2. interaction.options.getSubcommandGroup() = "warnings"
3. interaction.options.getSubcommand() = "list"
4. Traverse: commands.get("moderation")._children.get("warnings")._children.get("list")
5. Execute matched command
```

**For message commands (`!moderation ban`):**
```
1. Split: ["moderation", "ban"]
2. Traverse: commands.get("moderation") -> _children.get("ban")
3. Execute matched command
```

### Discord API Compatibility

Discord's API supports:
- **Subcommands**: `/command subcommand`
- **Subcommand Groups**: `/command group subcommand`
- **Max depth**: 2 levels (group → subcommand)

**Note**: Discord limits subcommand nesting to 2 levels. The file system can support unlimited depth for prefix commands, but slash commands will be capped at 2 levels per Discord's API constraints.

### Benefits

1. **Better organization**: Each subcommand in its own file
2. **Scalability**: Easy to add new subcommands
3. **Unlimited depth** (for prefix commands)
4. **Automatic registration**: No manual subcommand arrays
5. **Cleaner codebase**: Separation of concerns
6. **Maintainability**: Easier to locate and modify subcommands

### Migration Example

**Current structure:**
```
src/commands/moderation/
  ban.ts
  kick.ts
  warnings.ts
```

**After refactor:**
```
src/commands/moderation/
  _default.ts          # Optional: general moderation info
  ban.ts               # /moderation ban
  kick.ts              # /moderation kick
  warnings/
    _default.ts        # /moderation warnings (shows user warnings)
    list.ts            # /moderation warnings list
    clear.ts           # /moderation warnings clear
```

**Slash command mapping:**
- `/moderation ban` → `moderation/ban.ts`
- `/moderation kick` → `moderation/kick.ts`
- `/moderation warnings` → `moderation/warnings/_default.ts`
- `/moderation warnings list` → `moderation/warnings/list.ts`
