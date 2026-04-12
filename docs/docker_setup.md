# Docker & Database Setup Guide

This guide covers how to run the Quinn Discord bot with Docker and PostgreSQL database.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/) (included with Docker Desktop)
- Node.js 20+ (for local development without Docker)

## Quick Start with Docker

### 1. Configure Environment Variables

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Required variables in `.env`:
- `DISCORD_TOKEN` - Your Discord bot token
- `OWNER_ID` - Your Discord user ID
- `DATABASE_URL` - Already configured for Docker: `postgresql://postgres:postgres@postgres:5432/quinn`

### 2. Build and Start Services

```bash
# Build and start both the bot and PostgreSQL database
npm run docker:up

# Or using docker compose directly
docker compose up -d
```

This will:
- Start a PostgreSQL container with persistent data
- Build and start the Quinn bot container
- Connect them on a shared network

### 3. View Logs

```bash
npm run docker:logs
# or
docker compose logs -f quinn-bot
```

### 4. Stop Services

```bash
npm run docker:down
# or
docker compose down
```

## Database Management

### Run Database Migrations

```bash
# Generate migration files from schema changes
npm run db:generate

# Apply migrations to the database
npm run db:migrate

# Push schema directly to database (development only)
npm run db:push
```

### Open Drizzle Studio (Database GUI)

```bash
npm run db:studio
```

This opens a web UI at `http://localhost:4567` to browse and edit your database.

## Local Development (Without Docker)

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up PostgreSQL Locally

Install PostgreSQL and create a database:

```bash
# Create database
createdb quinn

# Or with psql
psql -U postgres
CREATE DATABASE quinn;
```

### 3. Configure Environment

In your `.env` file:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/quinn
DB_SSL=false
```

### 4. Run Database Migrations

```bash
npm run db:push
```

### 5. Start the Bot

```bash
# Development mode (with hot reload)
npm run dev

# Production build
npm run build
npm start
```

## Docker Commands Reference

| Command | Description |
|---------|-------------|
| `npm run docker:build` | Rebuild Docker images |
| `npm run docker:up` | Start all services in background |
| `npm run docker:down` | Stop all services |
| `npm run docker:logs` | View logs with follow mode |
| `npm run db:generate` | Generate migration files |
| `npm run db:migrate` | Apply migrations |
| `npm run db:push` | Push schema to DB (dev only) |
| `npm run db:studio` | Open Drizzle Studio GUI |

## Project Structure

```
Quinn/
├── db_integration/
│   ├── schema.ts           # Drizzle ORM schema definitions
│   ├── database.ts         # Database connection singleton
│   └── migrations/         # Generated migration files
├── src/
│   ├── services/           # Database service layer
│   │   ├── auditService.ts
│   │   ├── cooldownService.ts
│   │   ├── guildService.ts
│   │   ├── userService.ts
│   │   └── warningService.ts
│   ├── utils/
│   │   └── database.ts     # (optional legacy)
│   ├── client.ts           # ExtendedClient with db property
│   └── index.ts            # Main entry with DB initialization
├── docker-compose.yml      # Docker services configuration
├── Dockerfile              # Multi-stage Docker build
├── drizzle.config.ts       # Drizzle Kit configuration
└── .env.example            # Environment template
```

## Database Schema

The bot uses the following tables:

- **users** - Discord user tracking
- **guilds** - Server/guild settings
- **warnings** - Moderation warnings
- **cooldowns** - Command cooldown tracking
- **audit_logs** - Moderation action logging

## Accessing the Database in Commands

The database is available on the `ExtendedClient` instance:

```typescript
// In an event handler or command
if (ctx.client.db) {
  const warnings = await warningService.getUserWarnings(ctx.client.db, userId);
  // ...
}
```

## Troubleshooting

### Database Connection Fails

- Ensure PostgreSQL container is running: `docker compose ps`
- Check database logs: `docker compose logs postgres`
- Verify `DATABASE_URL` in `.env` matches the docker-compose service name

### Bot Won't Start

- Check all required env vars are set: `DISCORD_TOKEN`, `OWNER_ID`
- View container logs: `docker compose logs quinn-bot`

### Rebuild After Changes

```bash
docker compose down
npm run docker:build
npm run docker:up
```
