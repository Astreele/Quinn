# Database Integration Plan

## 1. Codebase Analysis Summary

### Application Overview
**Quinn** is a TypeScript Discord bot framework supporting both prefix commands (`$ping`) and slash commands (`/ping`). It features a file-based command system with moderation, utilities, fun commands, and admin tools.

### Current Architecture
- **Entry Point:** `src/index.ts` — initializes client, loads events/commands, logs in
- **Extended Client:** `src/client.ts` — holds `commands` and `cooldowns` collections
- **Command System:** File-based, recursively loaded from `src/commands/` with tree resolution
- **Event Handlers:** `src/events/` — `ready`, `messageCreate`, `interactionCreate`, `error`
- **Validation Layer:** `src/utils/validation.ts` — middleware for cooldowns, permissions, roles, hierarchy
- **Context Abstraction:** `src/context.ts` — unifies `Message` and `ChatInputCommandInteraction`

---

## 2. Findings: Data That Should Be Persisted

### 2.1. **Warnings System** (HIGH PRIORITY)

**Current Location:** `src/commands/moderation/user/warn.ts` (line 10)

**Current Implementation:**
```typescript
export const warningsDB: Map<string, Map<string, { reason: string; date: Date }[]>> = new Map();
```
Structure: `Map<guildId, Map<userId, Warning[]>>`

**Related Commands:**
- `/user warn` — creates a warning
- `/user warnings` — lists all warnings for a user

**Problem:** All warnings are **lost on bot restart**. Moderation history is not durable. The `/user warnings` command returns empty after a restart.

**Database Tables Needed:**
| Table | Columns |
|-------|---------|
| `warnings` | `id` (PK), `guild_id` (FK), `user_id`, `moderator_id`, `reason`, `created_at` |
| `guilds` *(optional)* | `id` (PK, Discord snowflake), `name`, `created_at`, `updated_at` |
| `users` *(optional)* | `id` (PK, Discord snowflake), `username`, `discriminator`, `created_at`, `updated_at` |

---

### 2.2. **Cooldowns** (LOW PRIORITY — Do NOT persist)

**Current Location:** `src/client.ts` (line 9)

**Current Implementation:**
```typescript
public cooldowns = new Collection<string, Collection<string, number[]>>();
```
Structure: `Map<commandName, Map<userId, timestamps[]>>`

**Decision:** Cooldowns are **intentionally ephemeral**. They reset on restart by design. No database persistence needed.

---

### 2.3. **Commands Collection** (NO PERSISTENCE NEEDED)

**Current Location:** `src/client.ts` (line 7)

**Current Implementation:**
```typescript
public commands = new Collection<string, Command>();
```

**Decision:** Commands are rebuilt from the filesystem on every startup/reload. No database persistence needed.

---

### 2.4. **Channel Lock/Unlock State** (NO PERSISTENCE NEEDED)

**Current Location:** `src/commands/moderation/channel/lock.ts` and `unlock.ts`

**Decision:** This state is stored in Discord's own permission overwrites system. It persists independently via Discord's infrastructure. No database needed.

---

## 3. Recommended Database Integration Approach

### Technology Stack
- **Database:** PostgreSQL (as specified)
- **ORM:** [Drizzle ORM](https://orm.drizzle.team/) or [Prisma](https://www.prisma.io/)
  - **Recommendation:** Drizzle ORM — lighter, TypeScript-native, better performance, closer to SQL
- **Connection Pooling:** `pg` library directly or via ORM's built-in pooling

### Project Structure (Proposed)
```
src/
├── db/
│   ├── index.ts              # Database client initialization
│   ├── schema.ts             # Table definitions (Drizzle) or Prisma schema
│   ├── migrations/           # Migration files
│   └── repositories/
│       └── warnings.ts       # Warning CRUD operations
├── commands/moderation/user/
│   ├── warn.ts               # Modified to use DB
│   └── warnings.ts           # Modified to use DB
└── ...
```

---

## 4. Implementation Plan

### Phase 1: Setup & Infrastructure

#### Step 1.1: Install Dependencies
```bash
npm install pg
npm install drizzle-orm
npm install -D drizzle-kit @types/pg
```

#### Step 1.2: Environment Configuration
Add to `.env` (create if not exists):
```env
DATABASE_URL=postgresql://username:password@localhost:5432/quinn_bot
```

#### Step 1.3: Database Schema Definition
Create `src/db/schema.ts`:
```typescript
import { pgTable, serial, text, varchar, timestamp, index } from 'drizzle-orm/pg-core';

export const guilds = pgTable('guilds', {
  id: varchar('id', { length: 20 }).primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: varchar('id', { length: 20 }).primaryKey(),
  username: text('username').notNull(),
  discriminator: varchar('discriminator', { length: 5 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const warnings = pgTable('warnings', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull().references(() => guilds.id),
  userId: varchar('user_id', { length: 20 }).notNull().references(() => users.id),
  moderatorId: varchar('moderator_id', { length: 20 }).notNull().references(() => users.id),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  guildUserIdx: index('warnings_guild_user_idx').on(table.guildId, table.userId),
}));
```

#### Step 1.4: Database Client Initialization
Create `src/db/index.ts`:
```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
export * from './schema';
```

#### Step 1.5: Migration Setup
Create `drizzle.config.ts`:
```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

Add scripts to `package.json`:
```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

---

### Phase 2: Repository Layer

#### Step 2.1: Warnings Repository
Create `src/db/repositories/warnings.ts`:
```typescript
import { db, warnings, users, guilds } from '../index';
import { eq, desc } from 'drizzle-orm';

export interface WarningInput {
  guildId: string;
  userId: string;
  moderatorId: string;
  reason: string;
}

export class WarningsRepository {
  async create(input: WarningInput) {
    return db.insert(warnings).values(input).returning();
  }

  async getByUser(guildId: string, userId: string) {
    return db.select()
      .from(warnings)
      .where(eq(warnings.guildId, guildId))
      .where(eq(warnings.userId, userId))
      .orderBy(desc(warnings.createdAt));
  }

  async getCount(guildId: string, userId: string) {
    const result = await db.select({ count: warnings.id })
      .from(warnings)
      .where(eq(warnings.guildId, guildId))
      .where(eq(warnings.userId, userId));
    return result.length;
  }

  async delete(warningId: number) {
    return db.delete(warnings).where(eq(warnings.id, warningId)).returning();
  }
}
```

---

### Phase 3: Command Modifications

#### Step 3.1: Update `warn.ts`
**Before:**
```typescript
export const warningsDB: Map<string, Map<string, { reason: string; date: Date }[]>> = new Map();
// ... in execute:
let guildWarnings = warningsDB.get(guildId);
if (!guildWarnings) {
  guildWarnings = new Map();
  warningsDB.set(guildId, guildWarnings);
}
// ... add to in-memory map
```

**After:**
```typescript
import { WarningsRepository } from '../../../../db/repositories/warnings';

const warningsRepo = new WarningsRepository();

// In execute function:
await warningsRepo.create({
  guildId,
  userId: target.id,
  moderatorId: context.user.id,
  reason,
});
```

#### Step 3.2: Update `warnings.ts`
**Before:**
```typescript
const guildWarnings = warningsDB.get(guildId);
const userWarnings = guildWarnings?.get(target.id) || [];
```

**After:**
```typescript
import { WarningsRepository } from '../../../../db/repositories/warnings';

const warningsRepo = new WarningsRepository();

const userWarnings = await warningsRepo.getByUser(guildId, target.id);
```

---

### Phase 4: Initialization & Lifecycle

#### Step 4.1: Update Client Initialization
Modify `src/index.ts` or `src/client.ts`:
```typescript
import { db } from './db';

// Test connection on startup
try {
  await db.execute('SELECT 1');
  logger.info('Database connected successfully');
} catch (error) {
  logger.error('Failed to connect to database', error);
  process.exit(1);
}
```

#### Step 4.2: Graceful Shutdown
Ensure connection pool is closed on bot shutdown:
```typescript
process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});
```

---

### Phase 5: Future Extensions (Optional)

These are not currently in the codebase but are natural extensions:

| Feature | Description |
|---------|-------------|
| **Mod Actions Log** | Persist bans, kicks, timeouts, untimes with reasons and moderator info |
| **Server Settings** | Store per-guild configurations (prefix, language, moderation settings) |
| **User Profiles** | Track user stats, XP, levels, custom roles |
| **Command Usage Analytics** | Log command invocations for analytics/debugging |
| **Automod Rules** | Store per-guild automod configurations |

---

## 5. File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/db/schema.ts` | **CREATE** | Database table definitions |
| `src/db/index.ts` | **CREATE** | Database client initialization |
| `src/db/repositories/warnings.ts` | **CREATE** | Warning CRUD operations |
| `drizzle.config.ts` | **CREATE** | Drizzle migration config |
| `src/commands/moderation/user/warn.ts` | **MODIFY** | Replace in-memory Map with DB calls |
| `src/commands/moderation/user/warnings.ts` | **MODIFY** | Read from DB instead of in-memory Map |
| `src/index.ts` or `src/client.ts` | **MODIFY** | Add DB connection test on startup |
| `package.json` | **MODIFY** | Add DB scripts and dependencies |
| `.env` | **CREATE/MODIFY** | Add `DATABASE_URL` |

---

## 6. Quick Start Commands

```bash
# Install dependencies
npm install pg drizzle-orm
npm install -D drizzle-kit @types/pg

# Generate and run migrations
npm run db:generate
npm run db:migrate

# Or push schema directly (dev only)
npm run db:push

# Open Drizzle Studio (visual DB browser)
npm run db:studio
```

---

## 7. Risk Assessment

| Risk | Mitigation |
|------|------------|
| Database connection failures | Add retry logic and graceful fallback to in-memory (with warning) |
| Migration failures in production | Test migrations locally first; use `drizzle-kit generate` for versioned migrations |
| Performance bottlenecks | Add indexes on `guild_id` and `user_id`; use connection pooling |
| Data consistency (Discord snowflakes) | Use `varchar(20)` for IDs; add foreign key constraints |

---

## 8. Conclusion

The **only current candidate for database persistence** is the **warnings system**. All other state (cooldowns, commands, channel locks) is either intentionally ephemeral or managed by Discord itself.

The integration is straightforward:
1. Setup PostgreSQL + Drizzle ORM
2. Create schema for `warnings`, `guilds`, `users`
3. Replace the in-memory `Map` in `warn.ts` and `warnings.ts` with database calls
4. Add connection initialization with error handling

This is a **low-complexity, high-impact** change that will make moderation data durable across bot restarts.
