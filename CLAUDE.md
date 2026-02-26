# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run lint     # Run ESLint
npm run start    # Start production server
```

There are no automated tests in this project.

## Architecture

**La Cajita Poker** is a Next.js 15 PWA (Progressive Web App) for managing poker game sessions and tracking player statistics. It runs in Spanish and targets mobile-first usage.

### Stack
- **Next.js 15** with App Router, React 19, TypeScript
- **Supabase** (PostgreSQL) as the database/backend — all DB access goes through `lib/supabase.ts` (client) and `lib/database.ts` (service layer)
- **Tailwind CSS v4** with shadcn/ui components (Radix UI primitives)
- **Chart.js / Recharts** for statistics visualization
- **PWA**: service worker at `/public/sw.js`, manifest at `/public/manifest.json`

### Data Flow
All database operations are static methods on `DatabaseService` in [lib/database.ts](lib/database.ts). Components import this service directly — there is no API route layer.

The Supabase client in [lib/supabase.ts](lib/supabase.ts) also exports all TypeScript interfaces (`Player`, `Match`, `MatchPlayer`, `MatchWithPlayers`, `PlayerStats`, `ActiveMatch`).

### Key Concepts

**"Cajita"** is the poker chip unit. Each cajita has a monetary value (`caji_value`). Players buy in with `cajitas` and end with `final_chips`. `money_won` is calculated from the difference.

**Points system** (positions 1–8): `[10, 7, 5, 3, 2, 1, 0, 0]` — defined as `POINTS_DISTRIBUTION` in `lib/database.ts`. Tie-breaking: more `money_won` wins; fewer `cajitas` (buy-ins) wins ties; a stored `tieBreak` float is the final arbiter.

**Active matches** (`active_matches` table): draft/in-progress sessions stored as JSONB. Players fill in results during a live game. When finished, `registerActiveMatch()` promotes the draft into the permanent `matches`/`match_players` tables and deletes the active match.

### Routes
- `/` — Main dashboard: player stats, match history, charts, create new match or active match. This is a large "use client" component.
- `/partidas/[id]` — Edit an active match in progress.

### Database Schema
Tables in Supabase (scripts in [scripts/](scripts/)):
- `players` — id, name, created_at
- `matches` — id, date, caji_value, total_money, player_count, created_at
- `match_players` — id, match_id (→ matches), player_id (→ players), cajitas, final_chips, money_won, position, points, created_at
- `active_matches` — id, date, caji_value, player_count, players (JSONB array), created_at, updated_at

Run SQL scripts in order (01→05) against your Supabase project to initialize or migrate the schema.

### Environment Variables
Create `.env.local` with:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Components
- [components/ui/](components/ui/) — shadcn/ui component library (do not modify these directly; regenerate with shadcn CLI if needed)
- [components/theme-provider.tsx](components/theme-provider.tsx) — next-themes wrapper, default dark mode
- [components/offline-indicator.tsx](components/offline-indicator.tsx) — PWA offline status banner
- [components/pwa-install.tsx](components/pwa-install.tsx) — PWA install prompt
- [hooks/use-mobile.tsx](hooks/use-mobile.tsx) — breakpoint hook (mobile < 768px)
- [lib/utils.ts](lib/utils.ts) — `cn()` helper (clsx + tailwind-merge)
