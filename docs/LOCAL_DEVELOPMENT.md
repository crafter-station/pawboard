# Local Development Guide

This guide walks you through setting up Pawboard for local development with a full Supabase stack running in Docker.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or compatible container runtime)
- [Bun](https://bun.sh/) (v1.0+)
- Git

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-org/pawboard.git
cd pawboard

# 2. Install dependencies
bun install

# 3. Start local Supabase
bun supabase:start

# 4. Set up environment variables (see below)

# 5. Apply database migrations
bun db:migrate:local

# 6. Seed the database (optional)
bun db:seed:local

# 7. Start the dev server
bun dev
```

## Detailed Setup

### Step 1: Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.local.example .env.local
   ```

2. Start Supabase to get the keys:
   ```bash
   bun supabase:start
   ```

3. Get the JWT ANON_KEY (important: use the JWT key, not `sb_publishable_`):
   ```bash
   bunx supabase status --output json | grep ANON_KEY
   ```

4. Update `.env.local` with:
   ```env
   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY=<paste-the-JWT-ANON_KEY-here>
   GROQ_API_KEY=<your-groq-api-key>
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

> **Important:** The ANON_KEY must be the JWT format (starts with `eyJ...`). The `sb_publishable_` key does NOT work with Supabase Realtime.

### Step 2: Database Setup

Apply migrations to your local database:

```bash
bun db:migrate:local
```

Optionally, seed with test data:

```bash
bun db:seed:local
```

### Step 3: Start Development

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Commands

| Command | Description |
|---------|-------------|
| `bun dev` | Start Next.js dev server |
| `bun supabase:start` | Start local Supabase stack |
| `bun supabase:stop` | Stop local Supabase |
| `bun supabase:status` | Check Supabase status |
| `bun supabase:reset` | Reset database |
| `bun db:generate` | Generate migrations from schema changes |
| `bun db:generate:local` | Generate migrations (using local env) |
| `bun db:migrate` | Apply migrations to database |
| `bun db:migrate:local` | Apply migrations to local database |
| `bun db:seed:local` | Seed local database with test data |

## Local URLs

| Service | URL |
|---------|-----|
| Next.js App | http://localhost:3000 |
| Supabase Studio | http://localhost:54323 |
| Supabase API | http://localhost:54321 |
| PostgreSQL | localhost:54322 |
| Mailpit (Email) | http://localhost:54324 |

## Test Data

After running `bun db:seed:local`, you'll have:

- **Demo Session:** http://localhost:3000/demo-session
  - Pre-populated with sample cards
  - 3 test users (Alice, Bob, Charlie)

## Daily Development Workflow

```bash
# Start of day
bun supabase:start    # If not already running
bun dev               # Start Next.js

# Making schema changes
# 1. Edit db/schema.ts
# 2. Generate a migration
bun db:generate:local
# 3. Apply the migration
bun db:migrate:local

# End of day (optional)
bun supabase:stop     # Stops containers, data persists
```

## Schema Changes Workflow

We use Drizzle's generate + migrate workflow (not push):

1. **Edit the schema:** Modify `db/schema.ts`

2. **Generate a migration:**
   ```bash
   bun db:generate:local
   ```
   This creates a new SQL migration file in `drizzle/` folder.

3. **Review the migration:** Check the generated SQL file to ensure it's correct.

4. **Apply the migration:**
   ```bash
   bun db:migrate:local
   ```

5. **Commit both files:** Include `db/schema.ts` AND the new migration file in your commit.

> **Note:** Migration files in `drizzle/` are tracked in git and applied in order across all environments.

## Troubleshooting

### WebSocket connection fails in Chrome

If you see WebSocket errors in Chrome console:

1. Make sure you're using the JWT `ANON_KEY` (starts with `eyJ...`), not `sb_publishable_`
2. Try clearing cookies for localhost
3. Try an incognito window
4. Safari/Firefox may work if Chrome doesn't

### "relation does not exist" error

Migrations haven't been applied. Run:

```bash
bun db:migrate:local
```

### Port already in use

Stop any existing Supabase instances:

```bash
bun supabase:stop
docker ps  # Check for leftover containers
```

### Database connection refused

Make sure Docker is running and Supabase is started:

```bash
bun supabase:status
```

### Reset everything

To completely reset your local environment:

```bash
bun supabase:stop
docker volume rm $(docker volume ls -q --filter label=com.supabase.cli.project=pawboard)
bun supabase:start
bun db:migrate:local
bun db:seed:local
```

## Architecture

```
Local Development Stack
========================

Browser (localhost:3000)
    |
    v
Next.js Dev Server
    |
    +---> Drizzle ORM ---------> PostgreSQL (localhost:54322)
    |
    +---> Supabase Client -----> Kong API Gateway (localhost:54321)
                                      |
                                      +---> Realtime (WebSocket)
                                      +---> Auth (GoTrue)
                                      +---> Storage
                                      +---> PostgREST
```

## See Also

- [Contributing Guide](/docs/CONTRIBUTING.md) - PR workflow and guidelines
- [AGENTS.md](/AGENTS.md) - Coding conventions and patterns
