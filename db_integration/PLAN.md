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

## 9. Docker Containerization

### Overview
Wrap the application and PostgreSQL database in Docker containers to simplify deployment, ensure environment consistency, and make the bot portable across different hosting environments.

### Technology Stack
- **Container Runtime:** Docker + Docker Compose
- **Base Image:** `node:20-alpine` (lightweight, LTS)
- **Database Image:** `postgres:16-alpine`
- **Compose Version:** Docker Compose v2 (included with Docker Desktop / standard on most systems)

---

### 9.1 Project Structure (Updated)
```
Quinn/
├── src/
│   ├── db/
│   │   ├── index.ts
│   │   ├── schema.ts
│   │   ├── migrations/
│   │   └── repositories/
│   └── ...
├── db_integration/
│   └── PLAN.md
├── Dockerfile                    # Application container
├── docker-compose.yml            # Multi-container orchestration
├── .dockerignore                 # Exclude files from build context
├── .env                          # Environment variables (local dev)
├── .env.example                  # Template for environment variables
├── package.json
├── tsconfig.json
└── ...
```

---

### 9.2 Dockerfile

Create `Dockerfile` at project root:
```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built application
COPY --from=builder /app/dist ./dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S quinn -u 1001 -G nodejs

USER quinn

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

**Notes:**
- Multi-stage build keeps the final image lean (no TypeScript compiler, dev deps, or source code)
- Running as non-root user improves security
- Health check assumes you add a simple HTTP health endpoint (optional but recommended for container orchestration)

---

### 9.3 Docker Compose

Create `docker-compose.yml` at project root:
```yaml
services:
  bot:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: quinn-bot
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      - DISCORD_TOKEN=${DISCORD_TOKEN}
      - DISCORD_CLIENT_ID=${DISCORD_CLIENT_ID}
      - DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
    ports:
      - "3000:3000"  # Optional: only if you add an HTTP health/status endpoint
    networks:
      - quinn-network
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  db:
    image: postgres:16-alpine
    container_name: quinn-db
    restart: unless-stopped
    environment:
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=${POSTGRES_DB}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"  # Exposed for local development/migrations; restrict in production
    networks:
      - quinn-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  # Optional: Run migrations as a separate one-shot service
  migrate:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: quinn-migrate
    depends_on:
      db:
        condition: service_healthy
    environment:
      - DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
    command: npm run db:migrate
    networks:
      - quinn-network
    profiles:
      - migrate  # Only run when explicitly invoked: docker compose --profile migrate up

volumes:
  postgres-data:
    driver: local

networks:
  quinn-network:
    driver: bridge
```

---

### 9.4 Environment Variables

Create `.env.example` at project root:
```env
# Discord
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_bot_client_id_here

# PostgreSQL
POSTGRES_USER=quinn
POSTGRES_PASSWORD=changeme_secure_password
POSTGRES_DB=quinn_bot

# Derived (used internally by compose)
DATABASE_URL=postgresql://quinn:changeme_secure_password@db:5432/quinn_bot
```

Create `.env` for local development (copy from `.env.example` and fill in real values). Add `.env` to `.gitignore`.

---

### 9.5 Docker Ignore File

Create `.dockerignore` at project root:
```
node_modules
dist
.git
.github
.qwen
docs
db_integration
*.md
!README.md
.env
.env.*
.prettierrc
.prettierignore
eslint.config.js
tsconfig.json
```

---

### 9.6 Updated Development Workflow

#### Local Development (without Docker)
```bash
# Start PostgreSQL locally (if not using Docker)
# Then:
npm install
npm run db:migrate
npm run dev
```

#### Docker Development
```bash
# First-time setup
cp .env.example .env
# Edit .env with real values

# Build and start all services
docker compose up -d

# Run migrations
docker compose --profile migrate up

# View logs
docker compose logs -f bot

# Stop everything
docker compose down
```

#### Production Deployment
```bash
# Build production image
docker compose -f docker-compose.yml build

# Start services
docker compose -f docker-compose.yml up -d

# Run migrations
docker compose --profile migrate -f docker-compose.yml up

# Update (rebuild and restart)
docker compose up -d --build
```

---

### 9.7 Database Connection in Code

Update `src/db/index.ts` to handle containerized environment:
```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // SSL configuration for production environments
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});

export const db = drizzle(pool, { schema });
export * from './schema';
```

---

### 9.8 Health Endpoint (Optional but Recommended)

If you want Docker health checks to work, add a simple HTTP endpoint. Create `src/health.ts`:
```typescript
import http from 'http';
import { db } from './db';

const server = http.createServer(async (req, res) => {
  if (req.url === '/health') {
    try {
      await db.execute('SELECT 1');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', database: 'connected' }));
    } catch {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', database: 'disconnected' }));
    }
  } else {
    res.writeHead(404);
    res.end();
  }
});

export function startHealthServer(port = 3000) {
  server.listen(port, () => {
    console.log(`Health server listening on port ${port}`);
  });
  return server;
}
```

Then call `startHealthServer()` from `src/index.ts` during startup.

---

### 9.9 Updated Risk Assessment

| Risk | Mitigation |
|------|------------|
| Database container data loss | Use named volumes (`postgres-data`); back up volume regularly |
| Container networking issues | Use explicit Docker Compose network; verify service names resolve correctly |
| Secrets in `.env` files | Never commit `.env`; use secret management (Docker secrets, Vault, etc.) in production |
| Image bloat | Use multi-stage builds; base on Alpine; prune unused deps |
| Migration timing | Run migrations separately before starting the bot; use `depends_on` with health checks |

---

## 10. Updated File Changes Summary

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
| `.env` | **CREATE/MODIFY** | Add `DATABASE_URL` and Docker env vars |
| `Dockerfile` | **CREATE** | Multi-stage build for the application |
| `docker-compose.yml` | **CREATE** | Multi-container orchestration (bot + db + migrate) |
| `.dockerignore` | **CREATE** | Exclude unnecessary files from Docker build |
| `.env.example` | **CREATE** | Template for environment variables |
| `src/health.ts` | **CREATE** *(optional)* | HTTP health check endpoint |

---

## 11. Quick Start Commands

### Without Docker
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

### With Docker
```bash
# First-time setup
cp .env.example .env
# Edit .env with your Discord token and desired credentials

# Build and start everything
docker compose up -d --build

# Run database migrations
docker compose --profile migrate up

# View bot logs
docker compose logs -f bot

# Stop everything
docker compose down

# Stop and remove all data (destructive)
docker compose down -v
```

---

## 12. Conclusion

The **only current candidate for database persistence** is the **warnings system**. All other state (cooldowns, commands, channel locks) is either intentionally ephemeral or managed by Discord itself.

The integration is straightforward:
1. Setup PostgreSQL + Drizzle ORM (locally or via Docker)
2. Create schema for `warnings`, `guilds`, `users`
3. Replace the in-memory `Map` in `warn.ts` and `warnings.ts` with database calls
4. Add connection initialization with error handling
5. Containerize with Docker Compose for portable, one-command deployment

This is a **low-complexity, high-impact** change that will make moderation data durable across bot restarts and simplify depompose up -d --buildloyment through containerization.
