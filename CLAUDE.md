# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Morris Hub is a multi-module Next.js 16 application with iOS-style UI, designed to help users manage various life domains: Bible reading, finance tracking, career development, health & fitness, and family management. Each module is independently navigable and can share data through a unified Supabase backend.

## Development Commands

```bash
# Development server (http://localhost:3000)
npm run dev

# Production build
npm run build

# Run production build locally
npm start

# Linting
npm run lint

# Type checking (built into Next.js)
npm run build  # Includes type checking
```

## Architecture Overview

### Module-Based Organization

The app is organized into independent feature modules, each with its own directory under `app/`:

- **Bible** (`app/bible/`) — Scripture reading with TTS, reading plans, notes, highlights
- **Finance** (`app/finance/`) — Stock tracking, portfolio management, financial planning
- **Health** (`app/health/`) — Fitness tracking, workout logging, health metrics
- **Career** (`app/career/`) — Job applications, resume management, career planning
- **Investments** (`app/investments/`) — Investment research and portfolio tools
- **Family** (`app/family/`) — Family members, circles, shared planning
- **Home** (`app/home/`) — Dashboard and module shortcuts
- **News** (`app/news/`) — News feed integration
- **Auth** (`app/auth/`) — Authentication with Supabase

Each module typically contains:
- `page.tsx` — Main module page (server component)
- `layout.tsx` — Module layout wrapper
- `_components/` — Client components used within the module
- Subdirectories for features (e.g., `plans/`, `read/`, `settings/`)

### Shared Layer

**`lib/`** — Shared utilities, API clients, and helpers:
- `supabase/` — Supabase client initialization (server and client)
- `bible-api.ts` — Bible data structures and book/verse utilities
- `tts-voices.ts` — Text-to-speech voice ranking and selection
- `prefs.ts`, `prefs-shared.ts` — User preference utilities
- Domain-specific clients: `alpaca.ts` (stocks), `finnhub.ts`, `sports.ts`, etc.

**`app/api/`** — Next.js API routes for server-side logic:
- `/api/bible/` — Bible module APIs (chapters, plans, progress tracking)
- `/api/finance/` — Stock and portfolio data
- `/api/health/` — Workout and health data
- `/api/cron/` — Scheduled jobs (Vercel cron)
- `/api/tts-prefs/` — TTS voice preferences (single source of truth for voice settings)

**`components/`** — Reusable UI components (primarily iOS-style):
- `ios.tsx` — Core iOS-style components (LargeTitle, Group, Cell, Icons, etc.)

### Data Storage

**Supabase** is the primary data store with multiple schemas:
- `bible` — Reading plans, progress, highlights, bookmarks, notes
- `hub` — User preferences, family connections
- `finance` — Portfolios, watchlists, transactions
- `health` — Workouts, metrics
- `career`, `student_support`, `family` — Domain-specific data

Key RLS policies ensure users can only access their own and shared family data. Service client is used server-side for data that bypasses RLS.

## Next.js 16 Specifics

**Breaking changes from Next.js 14/15:**
- Read `node_modules/next/dist/docs/` for API changes before writing new code
- Pay attention to deprecation notices
- App Router is standard; no Pages Router

**Key patterns used:**
- **Server Components** — Default for data fetching (`createClient`, `createServiceClient`)
- **Client Components** — Use `"use client"` pragma for interactivity (state, effects, event handlers)
- **API Routes** — `app/api/[module]/[route]/route.ts` for backend endpoints
- **Dynamic Routes** — `[param]` directories for dynamic segments (e.g., `[bookId]/[chapter]`)

**Important imports:**
```typescript
import { redirect } from "next/navigation";        // Server-side redirect
import { useRouter } from "next/navigation";       // Client-side router
import { createClient, createServiceClient } from "@/lib/supabase/server";  // Server Supabase
import { createClient } from "@/lib/supabase/client";  // Client Supabase
```

## Key Data Flows

### Bible Reading Flow

1. User navigates to `/bible/read/[bookId]/[chapter]`
2. Server component fetches chapter data via `/api/bible/chapter`
3. `ChapterReader` client component handles:
   - Verse highlighting and bookmarking
   - Text-to-speech (Web Speech API) with auto-continue through plan
   - Voice/speed preferences from `/api/tts-prefs`
   - Note creation/editing
4. Auto-continue feature plays next readings in sequence without page reload (iOS requirement for hands-free audio)

### Reading Plans

Plans are stored in `reading_plans` table with daily schedule. Each user's progress tracked in `user_plans` and `reading_completions`. Plans can jump across books — the `upcomingReadings` list in ChapterReader controls what plays next during auto-continue, not just sequential chapters.

### User Preferences

Platform-wide TTS preferences (voice, speed) live in `hub.preferences` and are fetched via `/api/tts-prefs`. This is the single source of truth. Bible-specific settings (font size, translation) live in `bible.user_preferences`.

## iOS-Style UI System

The app uses custom iOS-style components for a native look:

```tsx
import { LargeTitle, Group, Cell, IconBadge, Icons, List, Segmented } from "@/components/ios";

// Typical layout:
<div className="ios-scroll">
  <LargeTitle title="Title" subtitle="Subtitle" />
  <Group header="Section">
    <Cell lead={<Icon />} title="Item" href="/path" />
  </Group>
</div>
```

Styling via CSS modules and tailwind; theme-aware (light/dark) via CSS custom properties (`--ios-tint`, `--ios-label`, etc.).

## Common Patterns

### Fetching Data (Server)
```typescript
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
const db = createServiceClient() as any;
const { data } = await db.schema("bible").from("table").select("*");
```

### Saving User Data (Client)
```typescript
const db = createClient() as any;
await db.schema("bible").from("highlights").upsert(
  { user_id: userId, verse_id: vId, color },
  { onConflict: "user_id,verse_id" }
);
```

### Voice Selection (Bible)
Text-to-speech voices are ranked in `lib/tts-voices.ts` by language, quality tier (Premium > Enhanced), and on-device status. `rankVoices()` returns English voices sorted best-first. Always use the saved preference from `/api/tts-prefs` on the reader component.

## Important Notes

- **Typescript path aliases**: `@/*` maps to repo root (e.g., `@/lib/bible-api` → `./lib/bible-api.ts`)
- **CSS/Styling**: Check `app/globals.css` and `app/ios.css` for theme variables and utility classes
- **Supabase Auth**: Uses Supabase OAuth; user context available via `supabase.auth.getUser()`
- **Environment variables**: Configured in `.env.local` (not committed); includes Supabase keys, Twilio, API credentials
- **Deployment**: Vercel with Supabase backend; domain subdomains redirect to main site
- **RLS Policies**: Always assume row-level security is enforced; use service client only when bypassing RLS is intentional
