![hero](public/pawboard_og.png)

<h1 align="center">Pawboard</h1>

<p align="center">
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white" alt="React" /></a>
  <a href="https://typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss&logoColor=white" alt="Tailwind" /></a>
  <a href="https://supabase.com/"><img src="https://img.shields.io/badge/Supabase-Realtime-3fcf8e?logo=supabase&logoColor=white" alt="Supabase" /></a>
  <a href="https://bun.sh/"><img src="https://img.shields.io/badge/Bun-runtime-f9f1e1?logo=bun" alt="Bun" /></a>
</p>

<p align="center">
  Where ideas land on their feet
  <br />
  <br />
  <a href="https://pawboard.app">Website</a>
  ·
  <a href="https://github.com/crafter-station/pawboard/issues">Issues</a>
  ·
  <a href="https://crafters.chat">Community</a>
</p>

## Documentation

- [Local Development Guide](/docs/LOCAL_DEVELOPMENT.md) - Set up your local environment
- [Contributing Guide](/docs/CONTRIBUTING.md) - How to contribute and PR workflow
- [Coding Guidelines](/AGENTS.md) - Code conventions and patterns

## Quick Start

For detailed setup instructions, see the [Local Development Guide](/docs/LOCAL_DEVELOPMENT.md).

```bash
# Install dependencies
bun install

# Start local Supabase
bun supabase:start

# Set up environment (copy .env.local.example to .env.local and add keys)
# Get ANON_KEY with: bunx supabase status --output json | grep ANON_KEY

# Apply migrations and seed database
bun db:migrate:local
bun db:seed:local

# Start dev server
bun dev
```

## Commands

### Development

```bash
bun dev              # Start dev server
bun build            # Production build
bun start            # Start production server
bun check            # Run linter
```

### Database

```bash
bun db:generate       # Generate migrations from schema changes
bun db:generate:local # Generate migrations (using local env)
bun db:migrate        # Apply migrations to database
bun db:migrate:local  # Apply migrations to local Supabase
bun db:seed:local     # Seed local database with test data
```

### Local Supabase

```bash
bun supabase:start   # Start local Supabase stack
bun supabase:stop    # Stop local Supabase
bun supabase:status  # Check status
bun supabase:reset   # Reset database
```


## Tech

- Next.js 16 (App Router, RSC)
- React 19
- TypeScript 5 (strict mode)
- Tailwind CSS 4 + shadcn/ui
- Supabase Realtime
- Drizzle ORM
- Zustand
