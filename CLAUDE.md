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

Vercel is on the **Hobby** plan. With a *private* repo, Hobby blocked every deploy pushed from Claude Code cloud sessions ("commit author did not have contributing access") — even unsigned commits authored as the owner with no co-author trailer. The fix was making the repo **public**, so keep it public: never commit secrets (they live only in Vercel env vars).

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

**Sueltas** (`is_casual` on `matches` and `active_matches`): one-off games played after the tournament night ends. Same flow as a normal match, but any player can join (not just the roster, and creating one doesn't add them to the roster), they can be created even with no open tournament, and they store `points = 0`. They don't belong to any tournament: new ones are saved with `tournament_id = NULL` (older rows may still carry one; it's ignored). They're fetched on their own with `getCasualMatches` / `getCasualActiveMatches` and shown in Partidas → Sueltas; `getAllMatches`, `getAllActiveMatches`, `getPlayerStats` and `getAllTimeStats` exclude them in SQL.

### Routes
- `/` — Main dashboard: player stats, match history, charts, create new match or active match. This is a large "use client" component.
- `/partidas/[id]` — Edit an active match in progress.

### Database Schema
Tables in Neon (DDL reference in [scripts/](scripts/), originally written for Supabase but pure standard Postgres):
- `tournaments` — id, name, closed_at, created_at (a `closed_at IS NULL` row is the active tournament)
- `players` — id, name, created_at
- `matches` — id, date, caji_value, total_money, player_count, tournament_id (→ tournaments), is_casual, created_at
- `match_players` — id, match_id (→ matches), player_id (→ players), cajitas, final_chips, money_won, position, points, created_at
- `active_matches` — id, date, caji_value, player_count, tournament_id (→ tournaments), is_casual, players (JSONB array), created_at, updated_at
- `training_answers` — id, player_id (→ players), drill, game, deck, correct, local_date (device date), street, seat (nullable; street of fixed-street drills is derived on read), created_at — one row per answered exercise in Entrenar
- `training_daily` — player_id, challenge_date (PK together), score, total, created_at — Desafío del día, one attempt per player per day

Schema changes for existing DBs ship as idempotent statements in [scripts/migrate.mjs](scripts/migrate.mjs), which Vercel runs on every build before `next build` (`npm run migrate`; a failure aborts the deploy). Keep the numbered `.sql` file as the reference too. To bootstrap a fresh Neon DB, run the numbered scripts in order (01→14) via `psql "$DATABASE_URL" -f scripts/0X-...sql`. The current production schema was migrated wholesale from Supabase via `pg_dump`.

### Environment Variables
Create `.env.local` with:
```
DATABASE_URL=postgresql://[user]:[pwd]@[host]-pooler.[region].aws.neon.tech/neondb?sslmode=require
APP_PIN=######            # 6-digit PIN shared with the group
APP_SECRET=<32 bytes hex> # HMAC secret for signing the auth cookie
GUEST_PIN=######          # optional: guest PIN (sueltas + Entrenar only); must differ from APP_PIN
```
Use the **pooled** Neon connection string (host contains `-pooler`) — the HTTP driver is built for serverless and the pooled endpoint scales to zero cleanly. Never expose any of these vars to the client (no `NEXT_PUBLIC_` prefix).

Generate `APP_SECRET` with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

If `APP_SECRET` is unset the middleware **fails open** (no auth) — make sure it's set in Vercel before deploying. Rotating either env var invalidates every existing session.

### Auth
PIN-gated, single shared credential. The middleware in [middleware.ts](middleware.ts) redirects any non-`/login` request to `/login` unless the `la_cajita_auth` cookie carries a valid HMAC-signed expiry token. Login flow lives at [app/login/page.tsx](app/login/page.tsx) with the server action in [app/login/actions.ts](app/login/actions.ts); logout is wired into the Configuración tab (gear icon; internal tab id is still `reglas`). Sessions last 30 days. Token logic is in [lib/auth.ts](lib/auth.ts) and uses Web Crypto only (works in both Edge and Node runtimes).

**Roles**: `APP_PIN` logs in as `admin` (everything); `GUEST_PIN` logs in as `guest`, who only sees Partidas (sueltas only) and Entrenar, plus Configuración with only the Ajustes card (theme, sounds, logout — [components/ajustes-card.tsx](components/ajustes-card.tsx)). The role is inside the signed token (`expiry.sig` = admin, the old format so existing sessions keep working; `expiry.guest.sig` = guest). It's enforced server-side: every tournament Server Action in `lib/database.ts` calls `requireAdmin()` ([lib/session.ts](lib/session.ts)), and active-match actions by id only let a guest touch sueltas. `deleteMatch` is admin-only. Any new Server Action must decide which role may call it. The client asks for the role with `getSessionRole()`.

### Components
- [components/ui/](components/ui/) — shadcn/ui component library (do not modify these directly; regenerate with shadcn CLI if needed)
- [components/theme-provider.tsx](components/theme-provider.tsx) — next-themes wrapper, default dark mode
- [components/offline-indicator.tsx](components/offline-indicator.tsx) — PWA offline status banner
- [components/pwa-install.tsx](components/pwa-install.tsx) — PWA install prompt
- [components/poker-chip.tsx](components/poker-chip.tsx) — SVG poker chip + `ChipSpinner` (the app-wide loading indicator)
- [components/celebration.tsx](components/celebration.tsx) — shared full-screen celebration pieces (overlay, animated podium, share footer)
- [components/match-summary.tsx](components/match-summary.tsx) — "Fin de la partida" screen; pure logic in [lib/match-summary.ts](lib/match-summary.ts), share image drawn on canvas in [lib/share-card.ts](lib/share-card.ts)
- [components/tournament-closing-podium.tsx](components/tournament-closing-podium.tsx) — animated tournament closing screen
- Card design (face, `CardBack` with the green felt + `LeafMark` leaf) lives in [components/training/playing-card.tsx](components/training/playing-card.tsx); the Nueva partida cards in `hole-cards.tsx` reuse it (the `.card-back-felt` class in globals.css)
- [components/hole-cards.tsx](components/hole-cards.tsx), [components/chip-case.tsx](components/chip-case.tsx), [components/chip-rain.tsx](components/chip-rain.tsx) — CSS-3D animations (Nueva partida cards, login chip case, chip rain). Animation keyframes live at the end of [app/globals.css](app/globals.css)
- [lib/sounds.ts](lib/sounds.ts) — sound effects via Web Audio (`playSound` / `playSequence`, both return a stop fn for effect cleanup). Files in `public/sounds/` (Kenney CC0, see `CREDITS.txt`; excluded from the auth middleware so the login can use them, precached by the service worker). Per-device mute toggle in Configuración (gear) → Ajustes via [hooks/use-sound-enabled.ts](hooks/use-sound-enabled.ts)
- [hooks/use-mobile.tsx](hooks/use-mobile.tsx) — breakpoint hook (mobile < 768px)
- [lib/utils.ts](lib/utils.ts) — `cn()` helper (clsx + tailwind-merge)

### Entrenar (training tab)
Human-facing guide (Spanish): [docs/motor-entrenar.md](docs/motor-entrenar.md) — file map, house rules, drill table with sources/confidence, and the step-by-step checklist for adding a drill. Keep it in sync when drills change. The single list of drill ids is [lib/poker/drill-ids.ts](lib/poker/drill-ids.ts) (`DRILL_IDS`, `GAME_FREE_DRILLS`); the server validator and difficulty read from it, `MAKERS` uses `satisfies Record<DrillId, …>` and the Desafío `Question` switch has an exhaustive `never` check.
Exercises run client-side; only progress touches the DB. Engine in [lib/poker/](lib/poker/): cards are ints `(rank-2)*4+suit` ([cards.ts](lib/poker/cards.ts)); [variants.ts](lib/poker/variants.ts) defines Hold'em / Omaha / Manhattan (how many hole cards each may use) × long/short deck; [evaluator.ts](lib/poker/evaluator.ts) scores 5-card hands (short deck: flush > full house, A-6-7-8-9 straight, straight > trips per house rules) and picks the best legal hand per game; [equity.ts](lib/poker/equity.ts) does exact/Monte Carlo equity and outs; [drills.ts](lib/poker/drills.ts) generates exercises (pure, seedable — see `tests/poker.test.ts`). UI in [components/training/](components/training/) and [components/tabs/entrenar-tab.tsx](components/tabs/entrenar-tab.tsx). The Ejercicios subtab is a menu grouped by topic (`GROUPS` in entrenar-tab: Leer la mano / Antes del flop / Pagar o no / Cuentas GTO); each drill opens on its own screen with "Volver"; drills, "Lo que más fallás" and the Desafío (playing or its result) use `useBackToClose` ([hooks/use-back-to-close.ts](hooks/use-back-to-close.ts)) so the phone's back gesture closes them instead of leaving the app. Te suben / Te resuben are separate menu entries but both record as `preflopVs`. Drills are generated in `useEffect` (random cards must not render during SSR). Progress: the player picks their name once per device (localStorage); every answer goes to `recordTrainingAnswer` via `TrainingContext` (fire-and-forget). Desafío del día ([lib/poker/training.ts](lib/poker/training.ts) `dailyChallenge(date)`) seeds the RNG with the date so the whole group gets the same 10 questions; in-progress answers are kept in localStorage so a reload resumes instead of restarting. Preflop opening ranges ([lib/poker/preflop.ts](lib/poker/preflop.ts), Hold'em long deck only) are copied verbatim from PokerStrategy.com's 6-max lessons; tests check each range parses to exactly the combo count the source publishes — keep that check if you touch them. The 4/5-handed mapping (drop early positions) is our own adaptation, and the UI says so. Calling / 3-bet / 4-bet ranges against a raise or a 3-bet (30 spots, 6-handed only) come from the same lessons: data in [preflop-vs-data.ts](lib/poker/preflop-vs-data.ts) (generated from the source, combo-exact because the source splits some hands by suit), logic in [preflop-vs.ts](lib/poker/preflop-vs.ts); tests check every line's published combo count. The `preflopVs` drill is Hold'em long only and never enters the Desafío (`dailyDrills` filters it; new drill ids go at the END of `DRILL_IDS`). GTO river drill ([lib/poker/gto.ts](lib/poker/gto.ts)) uses the exact single-street formulas (MDF = P/(P+B), alpha = B/(P+B), bluff share = B/(P+2B)); it's game-independent. `dailyDrills(date)` keeps GTO out of challenges before `GTO_IN_DAILY_FROM` so past dates regenerate the same questions — any new drill must follow the same pattern. EV drills ([lib/poker/ev.ts](lib/poker/ev.ts), UI in [ev-drills.tsx](components/training/ev-drills.tsx)): ¿Apostar o pasar? (EV of betting vs checking the river, counted over 10 hands in whole numbers), Defender contra bluffs con chances (`semiBluff`, river only, counted "of your 100 hands": drop the s hands their bluff beats anyway and defend the usual MDF of the rest, (1−s)×P/(P+B); `semiBluffDefense` keeps the general formula with draws) ¿All-in o fold? (short-stack shove with luz, counted over 10 shoves in whole numbers) and ¿Qué le queda? (`callDown`: what's left of a range that calls three bets = product of the MDFs, counted from 100 hands rounding each street). Ideas from the GTO Wizard "Daily Dose of GTO" ebook (copyrighted: only the math is used, tests check its worked examples; our notes, lesson index and adaptation plan in [docs/playbook-daily-dose-gto.md](docs/playbook-daily-dose-gto.md) — never commit the PDF or its text, the repo is public); game-independent like GTO (`GAME_FREE_DRILLS` in training.ts) all four are Beta (`BETA_DRILLS` in training.ts: Beta tag in the menu, never in the Desafío; `NOT_IN_DAILY` = preflopVs + Beta). Answer UI is shared in [drill-shell.tsx](components/training/drill-shell.tsx): `AnswerButton`/`answerTone` (glowing buttons, Entrenar only; optional `amount` pill = average win/loss via `callEv`) and the bottom `AnswerSheet` with "Ver por qué". Tables: `PokerTable` (heads-up, top/bottom seats) and `RingTable` (every seat around the oval in speaking order, used by Antes del flop) in [table-view.tsx](components/training/table-view.tsx). Money in drills is always a multiple of $100 (the smallest chip). Difficulty by level (Fácil 1–3 / Media 4–6 / Difícil 7+) lives in [difficulty.ts](lib/poker/difficulty.ts): `withDifficulty` picks among a few candidates by `difficultyScore`; "media" must stay identical to the plain generator, and the Desafío never uses it. Gamification (level from total right answers, `DAILY_GOAL` answers/day) lives in `training.ts` (`levelFor`). "Jugar contra bots" (plan in [docs/plan-jugar-contra-bots.md](docs/plan-jugar-contra-bots.md); the online table plan is paused): the hand engine is [lib/poker/table.ts](lib/poker/table.ts) — pure, immutable state (structuredClone per action, storable in localStorage), house rules (equal luz and no blinds, so checking preflop is allowed; first to act is left of the button on every street; no-limit with min raise = last full raise and short all-ins not reopening; side pots built from `committed`; odd chips go to the first winner left of the button; another cajita at ≤ ¼ of its value, applied at the next hand; `maxSeats` per game/deck). Tests in `tests/table.test.ts` include a chip-conservation fuzz. Bots in [lib/poker/bot.ts](lib/poker/bot.ts): equity vs the remaining opponents with random cards (`estimateEquity`, `BOT_TRIALS` per game) compared with pot odds in `decide` (pure, testable), plus some bluff/slowplay (`BOT_STYLE`); PokerStrategy ranges are NOT used (they assume blinds; the table plays with luz), so bots are Beta. Studies that measure how far Hold'em numbers are from Omaha/Manhattan/short deck live in [scripts/lab/](scripts/lab/) (seeded, repeatable; results in the playbook doc): anything adapted from Hold'em must show its measured error or a Beta label, never invented numbers. Other games get a clearly labelled **Beta** inferred from equity vs 2 random hands ([lib/poker/preflop-beta.ts](lib/poker/preflop-beta.ts)); its data file is generated by `npx tsx scripts/gen-preflop-beta.ts` — regenerate instead of hand-editing.
