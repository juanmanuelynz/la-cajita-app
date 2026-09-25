# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run lint     # Run ESLint
npm run start    # Start production server
npm test         # Run the Vitest suite (also gates Vercel builds and git push)
```

## Commits & Deploys

Vercel is on the **Hobby** plan, which blocks any deploy it can't attribute to the account owner ("commit author did not have contributing access"). So:

- Commit author and committer must be `juanmanuelynz <juanmanuelynz@gmail.com>`. In a fresh environment run `git config user.name juanmanuelynz && git config user.email juanmanuelynz@gmail.com` before committing.
- **Don't sign commits.** Claude Code cloud sessions sign with their own SSH key, which GitHub shows as "Unverified" (`unknown_key`). Commit with `git -c commit.gpgsign=false commit ...`.
- Don't add a `Co-Authored-By:` trailer to commit messages.

## Architecture

**La Cajita Poker** is a Next.js 15 PWA (Progressive Web App) for managing poker game sessions and tracking player statistics. It runs in Spanish and targets mobile-first usage.

### Stack
- **Next.js 15** with App Router, React 19, TypeScript
- **Neon** (serverless PostgreSQL) via `@neondatabase/serverless` HTTP driver — all DB access goes through Server Actions in `lib/database.ts`
- **Tailwind CSS v4** with shadcn/ui components (Radix UI primitives)
- **Chart.js / Recharts** for statistics visualization
- **PWA**: service worker at `/public/sw.js`, manifest at `/public/manifest.json`

### Data Flow
All database operations are top-level async functions in [lib/database.ts](lib/database.ts), declared as Server Actions via the file-level `"use server"` directive. Client components import them with `import * as db from "@/lib/database"` and call them like local async functions — Next.js transparently serializes args, runs the function server-side against Neon, and returns the result. There is no REST/API route layer.

TypeScript interfaces (`Player`, `Match`, `MatchPlayer`, `MatchWithPlayers`, `PlayerStats`, `ActiveMatch`, `Tournament`) live in [lib/types.ts](lib/types.ts) — a plain types-only module that can be imported by both client and server code.

The Neon `DATABASE_URL` is read server-side only; it must not be prefixed with `NEXT_PUBLIC_`. There is no anon-key/RLS layer — the entire DB trust boundary is at the Server Action.

### Key Concepts

**"Cajita"** is the poker chip unit. Each cajita has a monetary value (`caji_value`). Players buy in with `cajitas` and end with `final_chips`. `money_won` is calculated from the difference.

**Points system** (positions 1–8): `[10, 7, 5, 3, 2, 1, 0, 0]` — defined as `POINTS_DISTRIBUTION` in `lib/database.ts`. Tie-breaking: more `money_won` wins; fewer `cajitas` (buy-ins) wins ties; a stored `tieBreak` float is the final arbiter.

**Active matches** (`active_matches` table): draft/in-progress sessions stored as JSONB. Players fill in results during a live game. When finished, `registerActiveMatch()` promotes the draft into the permanent `matches`/`match_players` tables and deletes the active match.

### Routes
- `/` — Main dashboard: player stats, match history, charts, create new match or active match. This is a large "use client" component.
- `/partidas/[id]` — Edit an active match in progress.

### Database Schema
Tables in Neon (DDL reference in [scripts/](scripts/), originally written for Supabase but pure standard Postgres):
- `tournaments` — id, name, closed_at, created_at (a `closed_at IS NULL` row is the active tournament)
- `players` — id, name, created_at
- `matches` — id, date, caji_value, total_money, player_count, tournament_id (→ tournaments), created_at
- `match_players` — id, match_id (→ matches), player_id (→ players), cajitas, final_chips, money_won, position, points, created_at
- `active_matches` — id, date, caji_value, player_count, tournament_id (→ tournaments), players (JSONB array), created_at, updated_at

To bootstrap a fresh Neon DB, run scripts 01→06 in order via `psql "$DATABASE_URL" -f scripts/0X-...sql`. The current production schema was migrated wholesale from Supabase via `pg_dump`.

### Environment Variables
Create `.env.local` with:
```
DATABASE_URL=postgresql://[user]:[pwd]@[host]-pooler.[region].aws.neon.tech/neondb?sslmode=require
APP_PIN=######            # 6-digit PIN shared with the group
APP_SECRET=<32 bytes hex> # HMAC secret for signing the auth cookie
```
Use the **pooled** Neon connection string (host contains `-pooler`) — the HTTP driver is built for serverless and the pooled endpoint scales to zero cleanly. Never expose any of these vars to the client (no `NEXT_PUBLIC_` prefix).

Generate `APP_SECRET` with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

If `APP_SECRET` is unset the middleware **fails open** (no auth) — make sure it's set in Vercel before deploying. Rotating either env var invalidates every existing session.

### Auth
PIN-gated, single shared credential. The middleware in [middleware.ts](middleware.ts) redirects any non-`/login` request to `/login` unless the `la_cajita_auth` cookie carries a valid HMAC-signed expiry token. Login flow lives at [app/login/page.tsx](app/login/page.tsx) with the server action in [app/login/actions.ts](app/login/actions.ts); logout is wired into the Reglas tab. Sessions last 30 days. Token logic is in [lib/auth.ts](lib/auth.ts) and uses Web Crypto only (works in both Edge and Node runtimes).

### Components
- [components/ui/](components/ui/) — shadcn/ui component library (do not modify these directly; regenerate with shadcn CLI if needed)
- [components/theme-provider.tsx](components/theme-provider.tsx) — next-themes wrapper, default dark mode
- [components/offline-indicator.tsx](components/offline-indicator.tsx) — PWA offline status banner
- [components/pwa-install.tsx](components/pwa-install.tsx) — PWA install prompt
- [hooks/use-mobile.tsx](hooks/use-mobile.tsx) — breakpoint hook (mobile < 768px)
- [lib/utils.ts](lib/utils.ts) — `cn()` helper (clsx + tailwind-merge)
