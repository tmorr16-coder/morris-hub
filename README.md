# Morris Hub

The application behind [morrisai.family](https://morrisai.family) — a private, invitation-only platform for one family, organized as eight independent apps that share a single account, design system, and Supabase backend.

| App | Route | What it does |
| --- | --- | --- |
| Hub | `/home` | Today view, reminders, weather, news, sports, family overview |
| Health | `/health` | Workouts, nutrition, body composition, medications, Oura + Withings sync |
| Finance | `/finance` | Connected accounts, net worth, retirement projections, tax |
| Investments | `/investments` | Stock research, live charts, watchlist, paper trading via Alpaca |
| Career | `/career` | AI advisor, goals, timeline, certifications, LSAT prep |
| Student Success | `/home/me/courses` | Courses, grades, flashcards — plus certifications and LSAT under `/career` |
| Bible | `/bible` | Reading plans, hands-free audio, highlights, notes, family challenges |
| Travel | `/travel` | Flight/stay/car search, trips, loyalty programs, check-in alerts |

Access to each app is granted per user; see `lib/module-access.ts`.

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
```

You will need a `.env.local` with Supabase credentials at minimum. Every other integration degrades gracefully when its key is absent — the feature reports that it is unconfigured rather than crashing.

## Commands

```bash
npm run dev            # development server
npm run build          # production build (includes type checking)
npm start              # serve the production build
npm run lint           # eslint
npm run check:scoping  # guard: finance queries must stay user-scoped
```

## Stack

- **Next.js 16** (App Router) + **React 19** + **Tailwind 4**
- **Supabase** — auth and Postgres, split across `hub`, `bible`, `finance`, `health`, `career`, `family`, and `student_support` schemas with row-level security. Migrations live in `supabase/migrations/`.
- **Anthropic SDK** for in-app AI, plus **OpenRouter** for the multi-model comparison panel
- Deployed on **Vercel**; scheduled syncs are declared in `vercel.json`

## Layout

```
app/<module>/       feature modules — page.tsx, layout.tsx, _components/
app/api/            route handlers, grouped by module
components/ios/     the iOS-native design system (Screen, Cell, GroupedList, …)
lib/                shared clients and helpers (Supabase, integrations, models)
supabase/migrations schema history
```

Two conventions worth knowing before you edit:

- **Model IDs live in `lib/models.ts`.** Pick a tier (`MODEL_FAST`, `MODEL_BALANCED`, `MODEL_DEEP`) rather than inlining a string, so upgrades are one edit. `lib/openrouter.ts` uses OpenRouter's separate `anthropic/…` namespace.
- **The iOS design system is opt-in**, scoped under `[data-ui="ios"]` in `app/ios.css`. A screen adopts it by rendering inside `IOSScreen`; screens that haven't migrated are unaffected.

See [CLAUDE.md](CLAUDE.md) for the fuller architecture notes.
