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

## Setup

```bash
bun install
cp env.example .env
bun run db:push
```

## Commands

### Development

```bash
bun run dev          # Start dev server
bun run build        # Production build
bun run start        # Start production server
bun run check        # Run linter
```

### Database

```bash
bun run db:generate  # Generate migrations from schema changes
bun run db:migrate   # Apply pending migrations to database
bun run db:push      # Sync schema directly to database (dev only)
```

### Supabase

```bash
bunx supabase init
bunx supabase start
```

Create a `.env.local` file with the following variables:

```
DATABASE_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY=eyJ...
GROQ_API_KEY=gsk_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Replace the SUPABASE variables with the values generated with `supabase start`.

Create tables and apply migrations:

```bash
bun db:push
```


## Tech

- Next.js 16 (App Router, RSC)
- React 19
- TypeScript 5 (strict mode)
- Tailwind CSS 4 + shadcn/ui
- Supabase Realtime
- Drizzle ORM
- Zustand
