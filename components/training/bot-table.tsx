"use client"

// "Mesa de práctica" (docs/plan-jugar-contra-bots.md): armar la mesa, jugar
// manos completas contra bots y ver cómo terminaste. Todo corre en el celular;
// la mesa se guarda en localStorage para seguir en la misma mano si se cierra.
// Es de práctica: no se anota en ningún lado.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Bot, Crown, Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { addHandToReads, botAct, botLevelOf, botWantsCajita, EMPTY_READS, makeBots, NANO_NAME, type BotDecision, type PlayerReads } from "@/lib/poker/bot"
import { DIFFICULTY_NAMES, type Difficulty } from "@/lib/poker/difficulty"
import { reviewHand, reviewSpots, type ReviewedSpot } from "@/lib/poker/review"
import {
  canRequestCajita,
  createTable,
  DEFAULT_CONFIG,
  legalActions,
  maxSeats,
  netResult,
  potTotal,
  requestCajita,
  startHand,
  act,
  type Action,
  type BettingStreet,
  type Structure,
  type TableConfig,
  type TableState,
} from "@/lib/poker/table"
import { GAMES, GAME_IDS, type GameId, type Variant } from "@/lib/poker/variants"
import type { DeckType } from "@/lib/poker/cards"
import { CardRow } from "./playing-card"
import { PotPill, RingTable, type RingSeat } from "./table-view"
import { pesos } from "./drill-shell"

const STORAGE_KEY = "la-cajita:bots:mesa"

interface Thought {
  seat: number
  street: BettingStreet
  decision: BotDecision
}
const STREET_NAMES: Record<BettingStreet, string> = { preflop: "Preflop", flop: "Flop", turn: "Turn", river: "River" }
const SETUP_KEY = "la-cajita:bots:armado"
/** Lo que Nano viene aprendiendo de cómo jugás en la mesa guardada. */
const READS_KEY = "la-cajita:bots:lectura"
/** Nivel de Entrenar desde el que se puede desafiar a Nano (Leyenda). */
export const NANO_UNLOCK_LEVEL = 9
const HERO = 0
/** Pausa entre jugadas de los bots, para poder seguirlas. */
const BOT_DELAY_MS = 900

type Mode = "fijo" | "rota"

interface Setup {
  mode: Mode
  game: GameId
  deck: DeckType
  bots: number
  structure: Structure
  cajita: number
  luz: number
  small: number
  big: number
  /** Qué tan fuertes juegan los bots: "auto" = según tu nivel de Entrenar. */
  botLevel: "auto" | Difficulty
  /** Desafiar a Nano (solo desde el nivel NANO_UNLOCK_LEVEL). */
  nano: boolean
}

const DEFAULT_SETUP: Setup = {
  mode: "fijo",
  game: "holdem",
  deck: "long",
  bots: 4,
  structure: "luz",
  cajita: 2000,
  luz: 100,
  small: 100,
  big: 200,
  botLevel: "auto",
  nano: false,
}

const variantsOf = (s: Setup): Variant[] =>
  s.mode === "fijo" ? [{ game: s.game, deck: s.deck }] : GAME_IDS.map((game) => ({ game, deck: s.deck }))

/** Bots que entran en la mesa con ese armado (el juego más justo manda). */
const maxBots = (s: Setup) => Math.min(...variantsOf(s).map((v) => maxSeats(v))) - 1

const variantLabel = (v: Variant) => `${GAMES[v.game].name} ${v.deck === "short" ? "Short" : "Long"}`

function load<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") as T | null
  } catch {
    return null
  }
}
/** La mesa guardada en este dispositivo (sigue abierta hasta "Terminar mesa"), o null. */
export function savedTableInfo(): { handsPlayed: number } | null {
  const t = load<TableState>(STORAGE_KEY)
  return t?.seats?.length ? { handsPlayed: t.handsPlayed ?? 0 } : null
}

function save(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // sin storage: se juega igual, pero no se retoma
  }
}

// ── Armado ────────────────────────────────────────────────────────────────

function Choice<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { id: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded-full bg-muted/70 p-1 text-sm">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "flex-1 whitespace-nowrap rounded-full px-2 py-1.5 transition-all",
            value === o.id ? "bg-background font-semibold text-foreground shadow" : "text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Stepper({
  label,
  value,
  step,
  min,
  max,
  money = true,
  onChange,
}: {
  label: string
  value: number
  step: number
  min: number
  max: number
  money?: boolean
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-full"
          disabled={value - step < min}
          onClick={() => onChange(value - step)}
          aria-label={`Menos ${label}`}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="w-16 text-center font-semibold tabular-nums">{money ? pesos(value) : value}</span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-full"
          disabled={value + step > max}
          onClick={() => onChange(value + step)}
          aria-label={`Más ${label}`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function Field({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="px-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

/** Si los bots usan rangos de PokerStrategy o nuestra cuenta. */
function usesRanges(structure: Structure, variants: Variant[], players: number) {
  return (
    structure === "ciegas" &&
    variants.some((v) => v.game === "holdem" && v.deck === "long") &&
    players >= 4 &&
    players <= 6
  )
}

function BotsNote({ structure, variants, players }: { structure: Structure; variants: Variant[]; players: number }) {
  const ranges = usesRanges(structure, variants, players)
  return (
    <p className="flex gap-2 rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
      <Bot className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        <b className="text-foreground">Cómo juegan:</b> deciden con su chance de ganar contra lo que tienen que pagar,
        teniendo en cuenta lo que apostaste (cuenta nuestra, medida en simulaciones).
        {ranges
          ? " En Hold'em Long, antes del flop, siguen los rangos de PokerStrategy."
          : structure === "ciegas"
            ? " Los rangos de PokerStrategy solo se usan en Hold'em Long con ciegas y de 4 a 6 jugadores."
            : " Con luz no usan rangos: los de PokerStrategy son para mesas con ciegas."}
        {ranges && " Los de nivel Fácil no los siguen: entran con cualquier cosa."}
      </span>
    </p>
  )
}

const LEVEL_HINTS: Record<Difficulty, string> = {
  facil: "Pagan casi todo y casi nunca bluffean: apostales tus buenas manos y no los bluffees.",
  media: "Juegan razonable: leen a medias lo que les apostás y el tamaño de su apuesta sigue a su mano.",
  dificil: "Leen lo que les apostás, apuestan con proyectos, usan la posición y apuestan igual con valor y con bluff.",
}

function SetupScreen({
  initial,
  onStart,
  playerDifficulty,
  nanoUnlocked,
}: {
  initial: Setup
  onStart: (s: Setup) => void
  playerDifficulty: Difficulty
  nanoUnlocked: boolean
}) {
  const [s, setS] = useState<Setup>(initial)
  const set = (patch: Partial<Setup>) =>
    setS((prev) => {
      const next = { ...prev, ...patch }
      next.bots = Math.max(1, Math.min(next.bots, maxBots(next)))
      if (next.big < next.small) next.big = next.small
      return next
    })
  const limit = maxBots(s)

  return (
    <div className="space-y-5">
      <Field title="Juego">
        <Choice
          value={s.mode}
          onChange={(mode) => set({ mode })}
          options={[
            { id: "fijo", label: "Fijo" },
            { id: "rota", label: "Se rota" },
          ]}
        />
        {s.mode === "fijo" ? (
          <Choice value={s.game} onChange={(game) => set({ game })} options={GAME_IDS.map((id) => ({ id, label: GAMES[id].name }))} />
        ) : (
          <p className="px-1 text-xs text-muted-foreground">Una vuelta de cada uno: Hold&apos;em, Omaha y Manhattan.</p>
        )}
        <Choice
          value={s.deck}
          onChange={(deck) => set({ deck })}
          options={[
            { id: "long", label: "Long (52)" },
            { id: "short", label: "Short (36)" },
          ]}
        />
      </Field>

      <Field title="Mesa">
        <Stepper label="Bots" value={s.bots} step={1} min={1} max={limit} money={false} onChange={(bots) => set({ bots })} />
        <p className="px-1 text-xs text-muted-foreground">
          Hasta {limit} con este juego (no dan las cartas para más).
        </p>
        <Stepper label="Cajita" value={s.cajita} step={500} min={1000} max={50000} onChange={(cajita) => set({ cajita })} />
      </Field>

      <Field title="Rivales">
        <Choice
          value={s.botLevel}
          onChange={(botLevel) => set({ botLevel })}
          options={[
            { id: "auto", label: "Tu nivel" },
            { id: "facil", label: DIFFICULTY_NAMES.facil },
            { id: "media", label: DIFFICULTY_NAMES.media },
            { id: "dificil", label: DIFFICULTY_NAMES.dificil },
          ]}
        />
        <p className="px-1 text-xs text-muted-foreground">
          {s.botLevel === "auto" && <>Según tu nivel en Entrenar: <b className="text-foreground">{DIFFICULTY_NAMES[playerDifficulty]}</b>. </>}
          {LEVEL_HINTS[s.botLevel === "auto" ? playerDifficulty : s.botLevel]}
        </p>
        {/* Nano no se anuncia: aparece de sorpresa al llegar al nivel NANO_UNLOCK_LEVEL. */}
        {nanoUnlocked && (
          <button
            type="button"
            onClick={() => set({ nano: !s.nano })}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm transition-colors",
              s.nano ? "border-amber-400/70 bg-amber-400/10" : "border-border",
            )}
            aria-pressed={s.nano}
          >
            <Crown className={cn("h-5 w-5 shrink-0", s.nano ? "text-amber-400" : "text-muted-foreground")} />
            <span className="flex-1">
              <b>Desafiar a {NANO_NAME}</b>
              <span className="block text-xs text-muted-foreground">
                El final boss: juega como Difícil y además te estudia durante la mesa (si te vas mucho, te bluffea; si pagás todo, no).
              </span>
            </span>
            <span className={cn("text-xs font-semibold", s.nano ? "text-amber-400" : "text-muted-foreground")}>{s.nano ? "Sí" : "No"}</span>
          </button>
        )}
      </Field>

      <Field title="Para entrar a la mano">
        <Choice
          value={s.structure}
          onChange={(structure) => set({ structure })}
          options={[
            { id: "luz", label: "Con luz" },
            { id: "ciegas", label: "Con ciegas" },
          ]}
        />
        {s.structure === "luz" ? (
          <Stepper label="Luz" value={s.luz} step={100} min={100} max={s.cajita / 4} onChange={(luz) => set({ luz })} />
        ) : (
          <>
            <Stepper label="Ciega chica" value={s.small} step={100} min={100} max={s.cajita / 4} onChange={(small) => set({ small })} />
            <Stepper label="Ciega grande" value={s.big} step={100} min={s.small} max={s.cajita / 2} onChange={(big) => set({ big })} />
          </>
        )}
      </Field>

      <BotsNote structure={s.structure} variants={variantsOf(s)} players={s.bots + 1} />

      <Button className="h-12 w-full text-base font-bold" onClick={() => onStart(s)}>
        Sentarse a jugar
      </Button>
      <p className="text-center text-xs text-muted-foreground">Es de práctica: no se anota en ningún lado.</p>
    </div>
  )
}

// ── Mesa ──────────────────────────────────────────────────────────────────

/** Cómo se dice lo último que hizo cada uno en la calle. */
function actionText(t: TableState, seat: number): RingSeat["action"] | undefined {
  const h = t.hand!
  const p = h.players.find((x) => x.seat === seat)
  if (!p) return { kind: "fold", text: "Afuera" }
  if (p.folded) return { kind: "fold", text: "Se fue" }
  const last = [...h.log].reverse().find((x) => x.seat === seat && x.street === h.street)
  if (!last) return undefined
  switch (last.action) {
    case "check":
      return { kind: "check", text: "Pasa" }
    case "call":
      return { kind: "check", text: "Paga" }
    case "raise": {
      // Con ciegas, antes del flop ya hay apuesta (la grande): siempre es subir.
      const before = h.log.slice(0, h.log.indexOf(last)).some((x) => x.street === h.street && x.to !== undefined)
      const blindsBet = h.street === "preflop" && t.config.structure === "ciegas"
      return { kind: "bet", text: before || blindsBet ? "Sube" : "Apuesta" }
    }
    case "allIn":
      return { kind: "bet", text: "All-in" }
    default:
      return undefined
  }
}

function seatsFor(t: TableState, heroName: string): RingSeat[] {
  const h = t.hand!
  const r = h.result
  return t.seats.map((s, i) => {
    const p = h.players.find((x) => x.seat === i)
    const shown = i === HERO || (!!r && r.showdown && !!p && !p.folded)
    // Lo ganado de verdad (sin lo que le devuelven porque nadie lo pagó).
    const won = r?.pots.filter((pot) => pot.winners.includes(i) && (pot.eligible.length > 1 || !r.showdown)).reduce((sum, pot) => sum + pot.amount / pot.winners.length, 0)
    const name = i === HERO ? heroName : s.name
    return {
      key: s.id,
      label: i === HERO ? pesos(s.stack) : `${name} · ${pesos(s.stack)}`,
      hero: i === HERO,
      cards: p && shown ? p.hole : undefined,
      action: r && won ? { kind: "bet", text: `Gana ${pesos(won)}` } : actionText(t, i),
      chip: p && !r && p.streetBet > 0 ? pesos(p.streetBet) : undefined,
      dealer: h.button === i,
    }
  })
}

/** Montos rápidos para apostar o subir: fracciones del pozo, recortadas a lo permitido. */
function quickSizes(t: TableState): { label: string; to: number }[] {
  const l = legalActions(t)!
  const h = t.hand!
  const pot = potTotal(h)
  const chip = t.config.chip
  const base = h.currentBet
  const out: { label: string; to: number }[] = []
  const add = (label: string, raw: number) => {
    const to = Math.min(l.maxTo, Math.max(l.minTo, Math.round(raw / chip) * chip))
    if (!out.some((o) => o.to === to)) out.push({ label, to })
  }
  add("Mínimo", l.minTo)
  add("½ pozo", base + (pot + l.toCall) / 2)
  add("Pozo", base + pot + l.toCall)
  add("All-in", l.maxTo)
  return out
}

function ActionBar({ t, onAct }: { t: TableState; onAct: (a: Action) => void }) {
  const l = legalActions(t)!
  const sizes = quickSizes(t)
  // Arranca en "½ pozo" (se vuelve a montar en cada jugada: ver la key en BotTable).
  const [to, setTo] = useState(sizes[Math.min(1, sizes.length - 1)]?.to ?? l.minTo)
  const chip = t.config.chip
  const raiseWord = t.hand!.currentBet === 0 ? "Apostar" : "Subir a"

  return (
    <div className="space-y-2 rounded-2xl border bg-card p-3">
      {l.canRaise && (
        <>
          <div className="flex gap-1.5">
            {sizes.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setTo(s.to)}
                className={cn(
                  "flex-1 rounded-full border px-1 py-1 text-xs",
                  to === s.to ? "border-primary bg-primary/15 font-semibold text-primary" : "text-muted-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" disabled={to - chip < l.minTo} onClick={() => setTo(to - chip)} aria-label="Menos">
              <Minus className="h-4 w-4" />
            </Button>
            <input
              type="range"
              min={l.minTo}
              max={l.maxTo}
              step={chip}
              value={to}
              onChange={(e) => {
                const v = Number(e.target.value)
                setTo(v >= l.maxTo - chip / 2 ? l.maxTo : v)
              }}
              className="flex-1 accent-[var(--primary)]"
              aria-label="Cuánto"
            />
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" disabled={to + chip > l.maxTo} onClick={() => setTo(Math.min(l.maxTo, to + chip))} aria-label="Más">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
      <div className="grid grid-cols-3 gap-2">
        <Button variant="outline" className="h-11" disabled={l.canCheck} onClick={() => onAct({ type: "fold" })}>
          Me voy
        </Button>
        {l.canCheck ? (
          <Button variant="outline" className="h-11" onClick={() => onAct({ type: "check" })}>
            Paso
          </Button>
        ) : (
          <Button variant="outline" className="h-11" onClick={() => onAct({ type: "call" })}>
            Pago {pesos(l.toCall)}
          </Button>
        )}
        <Button className="h-11 font-bold" disabled={!l.canRaise} onClick={() => onAct({ type: "raise", to })}>
          {to === l.maxTo && l.canRaise ? "All-in" : `${raiseWord} ${pesos(to)}`}
        </Button>
      </div>
    </div>
  )
}

function Summary({ t, heroName, onNew }: { t: TableState; heroName: string; onNew: () => void }) {
  const rows = t.seats
    .map((s, i) => ({ seat: i, name: i === HERO ? heroName : s.name, cajitas: s.cajitas, net: netResult(t, i), hero: i === HERO, nano: botLevelOf(s.id) === "nano" }))
    .sort((a, b) => b.net - a.net)
  const nano = rows.find((r) => r.nano)
  const heroRow = rows.find((r) => r.hero)!
  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-xl font-bold">Fin de la mesa</div>
        <div className="text-sm text-muted-foreground">{t.handsPlayed} manos jugadas</div>
      </div>
      {nano && (
        <div className={cn("flex items-center gap-2 rounded-2xl border p-3 text-sm", heroRow.net > nano.net ? "border-amber-400/70 bg-amber-400/10" : "")}>
          <Crown className={cn("h-5 w-5 shrink-0", heroRow.net > nano.net ? "text-amber-400" : "text-muted-foreground")} />
          {heroRow.net > nano.net ? (
            <span>
              <b>¡Le ganaste a {NANO_NAME}!</b> Terminaste mejor que el final boss.
            </span>
          ) : (
            <span>
              <b>{NANO_NAME} te ganó esta vez.</b> Revisá en &quot;Ver cómo pensaron los bots&quot; cuándo te bluffeó.
            </span>
          )}
        </div>
      )}
      <div className="divide-y rounded-2xl border">
        {rows.map((r) => (
          <div key={r.seat} className={cn("flex items-center justify-between px-3 py-2", r.hero && "bg-primary/10")}>
            <span className={cn("flex items-center gap-1", r.hero && "font-semibold")}>
              {r.nano && <Crown className="h-3.5 w-3.5 text-amber-400" />}
              {r.name}
            </span>
            <span className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">
                {r.cajitas} {r.cajitas === 1 ? "cajita" : "cajitas"}
              </span>
              <span className={cn("w-20 text-right font-semibold tabular-nums", r.net >= 0 ? "text-emerald-500" : "text-rose-500")}>
                {r.net < 0 ? `−${pesos(-r.net)}` : `+${pesos(r.net)}`}
              </span>
            </span>
          </div>
        ))}
      </div>
      <Button className="h-12 w-full text-base font-bold" onClick={onNew}>
        Nueva mesa
      </Button>
    </div>
  )
}

const VERDICT_STYLE: Record<ReviewedSpot["verdict"], { icon: string; tone: string }> = {
  bien: { icon: "✓", tone: "text-emerald-500" },
  mal: { icon: "✗", tone: "text-rose-500" },
  justo: { icon: "≈", tone: "text-amber-500" },
}

function verdictText(s: ReviewedSpot): string {
  if (s.verdict === "justo") return "da casi lo mismo pagar o irte"
  const did = s.played === "fold" ? "irte" : s.played === "raise" ? "seguir (subiste)" : "pagar"
  if (s.verdict === "bien") return `${did} estuvo bien`
  return s.played === "fold" ? "te alcanzaba para pagar" : "te convenía irte"
}

/** Repaso de la mano: en cada momento en que te apostaron, pagar o irte. */
function HandReview({ spots }: { spots: ReviewedSpot[] }) {
  const pct = (x: number) => `${Math.round(x * 100)}%`
  return (
    <div className="space-y-2 rounded-2xl border p-3 text-xs">
      <ol className="space-y-2">
        {spots.map((s) => {
          const v = VERDICT_STYLE[s.verdict]
          return (
            <li key={s.index} className="flex gap-2">
              <span className="w-12 shrink-0 text-muted-foreground">{STREET_NAMES[s.street]}</span>
              <span className="min-w-0 flex-1 space-y-0.5">
                <span className="block">
                  Pagabas {pesos(s.toCall)} para un pozo de {pesos(s.pot + s.toCall)}: necesitabas <b>{pct(s.needed)}</b>, tenías{" "}
                  <b className={s.equity >= s.needed ? "text-emerald-500" : "text-rose-500"}>{pct(s.equity)}</b>.
                </span>
                <span className={cn("block font-semibold", v.tone)}>
                  {v.icon} {verdictText(s)}
                </span>
                {s.actual !== null && (
                  <span className="block text-muted-foreground">Contra sus cartas (se vieron al final): {pct(s.actual)}.</span>
                )}
              </span>
            </li>
          )
        })}
      </ol>
      <p className="text-muted-foreground">
        Tu chance se calcula con lo que sabías: contra las manos que podía tener cada uno según cómo apostó. Como en
        &quot;¿Call o fold?&quot;, no cuenta lo que puedas ganar después.
      </p>
    </div>
  )
}

/** "Difícil", "Difícil + Nano"… según los bots sentados. */
function tableLevelLabel(t: TableState): string {
  const levels = t.seats.slice(1).map((s) => botLevelOf(s.id))
  const rest = levels.find((l): l is Difficulty => l !== "nano")
  const base = rest ? DIFFICULTY_NAMES[rest] : ""
  return levels.includes("nano") ? (base ? `${base} + ${NANO_NAME}` : NANO_NAME) : base
}

/** Pantalla completa de "Mesa de práctica". */
export function BotTable({
  heroName = "Vos",
  difficulty = "media",
  level = null,
}: {
  heroName?: string
  /** Dificultad de Entrenar según tu nivel (la de los bots por defecto). */
  difficulty?: Difficulty
  /** Tu nivel de Entrenar (null sin nombre elegido): desbloquea a Nano. */
  level?: number | null
}) {
  const nanoUnlocked = (level ?? 0) >= NANO_UNLOCK_LEVEL
  const [table, setTable] = useState<TableState | null>(null)
  const [setup, setSetup] = useState<Setup>(DEFAULT_SETUP)
  const [ended, setEnded] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [loaded, setLoaded] = useState(false)
  /**
   * Por qué jugó así cada bot en la mano. Se muestra recién al terminar la
   * mano: durante la mano sería ver sus cartas ("bluff con 30%").
   */
  const [thoughts, setThoughts] = useState<Thought[]>([])
  const [showThoughts, setShowThoughts] = useState(false)
  /** Repaso de la mano: se calcula al tocar el botón (simula, así que no en cada render). */
  const [review, setReview] = useState<ReviewedSpot[] | null>(null)
  const [showReview, setShowReview] = useState(false)
  /** Cómo venís jugando en esta mesa (Nano lo usa para adaptarse). */
  const [reads, setReads] = useState<PlayerReads>(EMPTY_READS)

  // Retomar la mesa guardada (en useEffect: el reparto es al azar y no puede salir en el servidor).
  useEffect(() => {
    const saved = load<TableState>(STORAGE_KEY)
    if (saved?.hand) setTable(saved)
    const s = load<Setup>(SETUP_KEY)
    if (s) setSetup({ ...DEFAULT_SETUP, ...s })
    const r = load<PlayerReads>(READS_KEY)
    if (saved?.hand && r) setReads({ ...EMPTY_READS, ...r })
    setLoaded(true)
  }, [])
  useEffect(() => {
    if (loaded) save(STORAGE_KEY, ended ? null : table)
  }, [table, ended, loaded])
  useEffect(() => {
    if (loaded) save(READS_KEY, ended ? null : reads)
  }, [reads, ended, loaded])
  // Al terminar cada mano, sumar lo que hiciste (addHandToReads no cuenta dos veces la misma).
  const finished = table?.hand?.result ? table.hand : null
  useEffect(() => {
    if (finished && table) setReads((prev) => addHandToReads(prev, finished, HERO, table.config.structure))
  }, [finished, table])

  const start = (s: Setup) => {
    save(SETUP_KEY, s)
    setSetup(s)
    const config: TableConfig = {
      ...DEFAULT_CONFIG,
      cajita: s.cajita,
      structure: s.structure,
      luz: s.luz,
      blinds: { small: s.small, big: s.big },
      variants: variantsOf(s),
    }
    const botLevel = s.botLevel === "auto" ? difficulty : s.botLevel
    const players = [{ id: "vos", name: heroName }, ...makeBots(botLevel, s.bots, s.nano && nanoUnlocked)]
    setReads(EMPTY_READS)
    setEnded(false)
    setThoughts([])
    setShowThoughts(false)
    setReview(null)
    setShowReview(false)
    setTable(startHand(createTable(config, players)))
  }

  // Los bots juegan solos, con una pausa para poder seguirlos.
  // Mientras está abierto "¿Terminar la mesa?" la mesa queda en pausa.
  const toAct = table?.hand?.toAct ?? null
  const busy = useRef(false)
  useEffect(() => {
    if (!table || toAct === null || toAct === HERO || confirmEnd) return
    const id = setTimeout(() => {
      if (busy.current) return
      busy.current = true
      try {
        const h = table.hand!
        const r = botAct(table, Math.random, { reads: { [HERO]: reads } })
        setThoughts((prev) => [...prev, { seat: toAct, street: h.street, decision: r.decision }])
        setTable(r.table)
      } finally {
        busy.current = false
      }
    }, BOT_DELAY_MS)
    return () => clearTimeout(id)
  }, [table, toAct, reads, confirmEnd])

  const onAct = useCallback((a: Action) => setTable((t) => (t ? act(t, a) : t)), [])

  const nextHand = () => {
    if (!table) return
    let t = table
    t.seats.forEach((_, i) => {
      if (i !== HERO && botWantsCajita(t, i)) t = requestCajita(t, i)
    })
    const withChips = t.seats.filter((s) => s.stack + s.pending > 0)
    if (t.seats[HERO].stack === 0 && t.seats[HERO].pending === 0) return // tiene que pedir cajita o terminar
    if (withChips.length < 2) return
    setThoughts([])
    setShowThoughts(false)
    setReview(null)
    setShowReview(false)
    setTable(startHand(t))
  }

  const seats = useMemo(() => (table?.hand ? seatsFor(table, heroName) : []), [table, heroName])
  // Momentos en que te apostaron (sin chances: es rápido). Sin ninguno no hay repaso.
  const spotCount = useMemo(
    () => (table?.hand?.result ? reviewSpots(table.hand, HERO, table.config.structure, table.config.blinds.big).length : 0),
    [table],
  )
  const openReview = () => {
    if (!table?.hand) return
    if (!review) setReview(reviewHand(table.hand, HERO, table.config.structure, table.config.blinds.big))
    setShowReview((v) => !v)
  }

  if (!loaded) return null
  if (!table) return <SetupScreen initial={setup} onStart={start} playerDifficulty={difficulty} nanoUnlocked={nanoUnlocked} />
  if (ended) return <Summary t={table} heroName={heroName} onNew={() => { setTable(null); setEnded(false) }} />

  const h = table.hand!
  const r = h.result
  const heroTurn = toAct === HERO && !r
  const heroBroke = !!r && table.seats[HERO].stack === 0 && table.seats[HERO].pending === 0
  const canAsk = canRequestCajita(table, HERO)
  const heroPlayer = h.players.find((p) => p.seat === HERO)
  const winners = r ? Object.keys(r.won).map(Number) : []

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Mano {h.number} · {variantLabel(h.variant)} · {table.config.structure === "luz" ? `Luz ${pesos(table.config.luz)}` : `Ciegas ${pesos(table.config.blinds.small)}/${pesos(table.config.blinds.big)}`}
        </span>
        <span className="flex items-center gap-1">
          <Bot className="h-3 w-3" /> Bots {tableLevelLabel(table)}
        </span>
      </div>

      <RingTable
        seats={seats}
        // Con manos de 4–5 cartas y la mesa en el medio no entra todo en tamaño grande.
        heroCardSize={GAMES[h.variant.game].holeCount >= 4 ? "sm" : "md"}
        center={
          <>
            {h.board.length > 0 && (
              <CardRow cards={h.board} size={GAMES[h.variant.game].holeCount >= 4 ? "xs" : "sm"} className="flex-nowrap justify-center" />
            )}
            <PotPill>Pozo {pesos(r ? r.pots.reduce((s, p) => s + p.amount, 0) : potTotal(h))}</PotPill>
          </>
        }
      />

      {r ? (
        <div className="space-y-2 rounded-2xl border bg-card p-3 text-sm">
          {r.pots.map((pot, k) => {
            const name = (seat: number) => (seat === HERO ? heroName : table.seats[seat].name)
            // Un "pozo" con un solo candidato es lo que apostó de más y nadie pagó: se le devuelve.
            if (pot.eligible.length === 1 && r.showdown) {
              return (
                <div key={k} className="flex justify-between text-muted-foreground">
                  <span>
                    A <b className="text-foreground">{name(pot.eligible[0])}</b> le vuelven lo que nadie pagó
                  </span>
                  <span className="tabular-nums">{pesos(pot.amount)}</span>
                </div>
              )
            }
            const contested = r.pots.filter((p) => p.eligible.length > 1)
            const title = contested.length > 1 ? (contested.indexOf(pot) === 0 ? "Pozo principal" : "Pozo aparte") : null
            return (
              <div key={k} className="space-y-0.5">
                {title && (
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {title} · {pesos(pot.amount)}
                  </div>
                )}
                {pot.winners.map((w, j) => (
                  <div key={w} className="flex justify-between">
                    <span>
                      <b>{name(w)}</b>
                      {r.showdown && r.handNames[w] ? ` · ${r.handNames[w]}` : ""}
                    </span>
                    {pot.winners.length === 1 ? (
                      <span className="font-semibold text-emerald-500">+{pesos(pot.amount)}</span>
                    ) : (
                      j === 0 && <span className="text-xs font-semibold text-emerald-500">reparten {pesos(pot.amount)}</span>
                    )}
                  </div>
                ))}
              </div>
            )
          })}
          {r.pots.filter((p) => p.eligible.length > 1).length > 1 && (
            <div className="text-xs text-muted-foreground">
              Hubo pozo aparte: el que fue all-in con menos fichas solo juega por lo que puso.
            </div>
          )}
          {!r.showdown && <div className="text-xs text-muted-foreground">Se fueron todos: gana sin mostrar.</div>}
          {r.showdown && heroPlayer && !heroPlayer.folded && !winners.includes(HERO) && r.handNames[HERO] && (
            <div className="text-xs text-muted-foreground">Vos: {r.handNames[HERO]}</div>
          )}
          <div className="flex gap-2 pt-1">
            {canAsk && (
              <Button variant="outline" className="flex-1" onClick={() => setTable(requestCajita(table, HERO))}>
                Pedir cajita
              </Button>
            )}
            {!heroBroke && (
              <Button className="flex-1 font-bold" onClick={nextHand}>
                Siguiente mano
              </Button>
            )}
          </div>
          {heroBroke && <p className="text-xs text-muted-foreground">Te quedaste sin fichas: pedí otra cajita o terminá.</p>}
          {table.seats[HERO].pending > 0 && <p className="text-xs text-muted-foreground">Tu cajita entra en la mano siguiente.</p>}
        </div>
      ) : heroTurn ? (
        <ActionBar key={h.log.length} t={table} onAct={onAct} />
      ) : (
        <div className="flex h-[52px] items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
          {heroPlayer?.folded ? "Te fuiste: miran los bots…" : `Piensa ${table.seats[toAct ?? 0]?.name ?? ""}…`}
        </div>
      )}

      {r && spotCount > 0 && (
        <div className="space-y-2">
          <Button variant="outline" size="sm" className="w-full" onClick={openReview}>
            {showReview ? "Ocultar repaso" : "Repaso de la mano"}
          </Button>
          {showReview && review && <HandReview spots={review} />}
        </div>
      )}

      {r && thoughts.length > 0 && (
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setShowThoughts((v) => !v)}>
            {showThoughts ? "Ocultar" : "Ver cómo pensaron los bots"}
          </Button>
          {showThoughts && (
            <ol className="space-y-1.5 rounded-2xl border p-3 text-xs">
              {thoughts.map((th, k) => (
                <li key={k} className="flex gap-2">
                  <span className="w-16 shrink-0 text-muted-foreground">{STREET_NAMES[th.street]}</span>
                  <span>
                    <b>{table.seats[th.seat].name}</b> · {th.decision.reason}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        {!r && canAsk ? (
          <Button variant="ghost" size="sm" onClick={() => setTable(requestCajita(table, HERO))}>
            Pedir cajita
          </Button>
        ) : (
          <span />
        )}
        <Button variant="outline" size="sm" onClick={() => setConfirmEnd(true)}>
          Terminar mesa
        </Button>
      </div>

      <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Terminar la mesa?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a ver el resumen y la mesa se cierra. No vas a poder seguir jugando esta mesa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir jugando</AlertDialogCancel>
            <AlertDialogAction onClick={() => setEnded(true)}>Terminar mesa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
