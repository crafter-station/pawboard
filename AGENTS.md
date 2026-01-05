# AGENTS.md - Pawboard Coding Agent Guidelines

## Project Overview

Pawboard is a real-time collaborative ideation board with a cat theme, built with Next.js 16, React 19, Supabase Realtime, and Drizzle ORM.

## Build/Lint/Test Commands

```bash
# Development
bun dev                 # Start Next.js dev server

# Build
bun build               # Production build
bun start               # Start production server

# Linting
bun lint                # Run ESLint

# Database
bun db:push             # Push schema to database
bun db:generate         # Generate migrations
bun db:migrate          # Apply migrations
```

**Note:** No test framework is configured. When adding tests, use Vitest or Jest with React Testing Library.

## Tech Stack

| Category   | Technology                              |
| ---------- | --------------------------------------- |
| Framework  | Next.js 16 (App Router, RSC)            |
| React      | React 19                                |
| Language   | TypeScript 5 (strict mode)              |
| Database   | PostgreSQL via Drizzle ORM              |
| Realtime   | Supabase Realtime (channels, presence)  |
| Styling    | Tailwind CSS 4 + shadcn/ui (new-york)   |
| State      | Zustand                                 |
| AI         | Vercel AI SDK + Groq                    |
| Animation  | Motion (Framer Motion v12)              |
| Package    | Bun                                     |

## Code Style Guidelines

### Import Organization

Order imports as follows (no blank lines between groups):

1. React/Next.js core (`react`, `next/*`)
2. Third-party libraries (`@supabase/*`, `drizzle-orm`, `lucide-react`, `motion/*`)
3. Local components (`@/components/*`)
4. Local hooks (`@/hooks/*`)
5. Local utilities (`@/lib/*`)
6. Database imports (`@/db/*`)
7. Types (use `type` keyword for type-only imports)

```typescript
import { useState, useEffect, useCallback } from "react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "motion/react";
import { Textarea } from "@/components/ui/textarea";
import { useRealtimeCards } from "@/hooks/use-realtime-cards";
import { cn } from "@/lib/utils";
import type { Card } from "@/db/schema";
```

### Naming Conventions

| Element     | Convention           | Example                          |
| ----------- | -------------------- | -------------------------------- |
| Files       | kebab-case           | `use-realtime-cards.ts`          |
| Components  | PascalCase           | `IdeaCard`, `RealtimeCursors`    |
| Hooks       | camelCase, use-prefix| `useRealtimeCards`, `useFingerprint` |
| Functions   | camelCase            | `generateSessionId`, `createCard`|
| Constants   | SCREAMING_SNAKE_CASE | `STORAGE_KEY`, `THROTTLE_MS`     |
| Types       | PascalCase           | `Card`, `NewCard`, `Session`     |

### TypeScript

- Strict mode is enabled - never use `any`
- Prefer type inference; add explicit types when not obvious
- Use `type` keyword for type-only imports: `import type { Card } from "@/db/schema"`
- Use Drizzle's `$inferSelect` and `$inferInsert` for DB types
- Use `React.ComponentProps<"element">` for extending HTML element props

```typescript
// Drizzle type inference
export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;

// Component props
interface IdeaCardProps extends React.ComponentProps<"div"> {
  card: Card;
  onMove: (id: string, x: number, y: number) => void;
}
```

### Error Handling

Use try-catch with `{ data, error }` return pattern for server actions:

```typescript
export async function createCard(data: NewCard) {
  try {
    const card = await db.insert(cards).values(data).returning();
    return { card: card[0], error: null };
  } catch (error) {
    console.error("Database error in createCard:", error);
    return { card: null, error: "Failed to create card" };
  }
}
```

For client-side hooks, use try-catch with `console.error` and fallback values.

## Framework Patterns

### Next.js App Router

- Use `"use client"` directive at top of client components
- Use `"use server"` directive for server actions (in `app/actions.ts`)
- Dynamic routes use `Promise<{ params }>` pattern:

```typescript
interface Props {
  params: Promise<{ sessionId: string }>;
}

export default async function SessionPage({ params }: Props) {
  const { sessionId } = await params;
  // ...
}
```

### Server Actions

Define in `app/actions.ts` with `"use server"` directive:

```typescript
"use server";

export async function createCard(data: NewCard) {
  // Validation, DB operation, return { data, error }
}
```

### API Routes

Use route handlers in `app/api/*/route.ts`:

```typescript
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();
  // Process and return NextResponse.json()
}
```

### Supabase Realtime

Use channels with typed event payloads:

```typescript
type CardEvent =
  | { type: "card:add"; card: Card }
  | { type: "card:move"; id: string; x: number; y: number }
  | { type: "card:update"; id: string; content: string };

channel.on("broadcast", { event: "card-event" }, ({ payload }) => {
  const event = payload as CardEvent;
  // Handle typed event
});
```

### Drizzle ORM

Schema in `db/schema.ts`, client in `db/index.ts`:

```typescript
// Schema
export const cards = pgTable("cards", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  x: integer("x").notNull().default(0),
  y: integer("y").notNull().default(0),
});
```

### React Components

- Functional components only
- Custom hooks for reusable logic (in `hooks/`)
- Use `useCallback` and `useRef` for performance
- Throttle realtime updates (typically 50-100ms)

### Styling

- Use Tailwind CSS classes
- Use `cn()` utility from `@/lib/utils` for conditional classes
- shadcn/ui components in `components/ui/`
- CSS variables defined in `app/globals.css`
- Dark mode via `next-themes` with class strategy

```typescript
import { cn } from "@/lib/utils";

<div className={cn("rounded-lg p-4", isActive && "border-primary")} />
```

## Directory Structure

```
app/
  [sessionId]/page.tsx    # Dynamic session board
  api/*/route.ts          # API routes
  actions.ts              # Server actions
  layout.tsx              # Root layout with providers
  page.tsx                # Home page
components/
  ui/                     # shadcn/ui components (DO NOT EDIT)
  elements/               # Custom reusable elements
  *.tsx                   # Feature components
db/
  index.ts                # Database client
  schema.ts               # Drizzle schema
hooks/                    # Custom React hooks (use-*.ts)
lib/
  supabase/               # Supabase clients
  utils.ts                # Utility functions
stores/                   # Zustand stores
```

## Environment Variables

Required in `.env.local`:

```
DATABASE_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY=eyJ...
GROQ_API_KEY=gsk_...
NEXT_PUBLIC_SITE_URL=https://pawboard.app
```

## Do's and Don'ts

**Do:**
- Use path aliases (`@/components`, `@/hooks`, etc.)
- Add new shadcn/ui components via `bunx shadcn@latest add <component>`
- Use server components by default, add `"use client"` only when needed
- Use optimistic UI updates with server persistence
- Follow existing patterns in the codebase

**Don't:**
- Edit files in `components/ui/` directly (managed by shadcn/ui)
- Use `any` type
- Skip error handling in server actions
- Use `npm` or `yarn` (project uses Bun)
- Commit `.env.local` or secrets
- Run database migrations directly - only edit `db/schema.ts`, user will apply migrations manually
