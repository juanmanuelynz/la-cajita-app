// Lógica pura del progreso y del Desafío del día (sin base de datos).

import { seededRng, type Rng } from "./cards"
import { makePreflopVs } from "./preflop-vs"
import { makeGto } from "./gto"
import { makeBetOrCheck, makeCallDown, makeSemiBluff, makeShove } from "./ev"
import { makeCompare, makeLuz, makeOuts, makePotOdds, makePreflop, makeUsable, makeWhoWins } from "./drills"
import type { Variant } from "./variants"
import { withDifficulty, type Difficulty } from "./difficulty"
import { POSITIONS_BY_TABLE } from "./preflop"

import { DRILL_IDS, type DrillId } from "./drill-ids"
export { DRILL_IDS, GAME_FREE_DRILLS, isGameFree, type DrillId } from "./drill-ids"

export const DRILL_NAMES: Record<DrillId, string> = {
  usable: "¿Qué tenés?",
  whoWins: "¿Quién gana?",
  outs: "Outs",
  potOdds: "¿Call o fold?",
  compare: "¿Cuál es mejor?",
  preflop: "Antes del flop (ciegas)",
  luz: "Antes del flop (luz)",
  gto: "GTO en el river",
  preflopVs: "Antes del flop (te suben)",
  betOrCheck: "¿Apostar o pasar?",
  semiBluff: "Defender contra bluffs con chances",
  shove: "¿All-in o fold?",
  callDown: "¿Qué le queda?",
}


/** Días seguidos entrenando, contando hasta hoy (o hasta ayer si hoy todavía no). */
export function dayStreak(dates: readonly string[], today: string): number {
  const set = new Set(dates)
  let day = today
  if (!set.has(day)) day = addDays(day, -1)
  let n = 0
  while (set.has(day)) {
    n++
    day = addDays(day, -1)
  }
  return n
}

/** Suma días a una fecha "YYYY-MM-DD" (en UTC, para no depender del huso). */
export function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

function hash(text: string): number {
  // FNV-1a de 32 bits
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export const DAILY_LENGTH = 10

const MAKERS = {
  usable: makeUsable,
  whoWins: makeWhoWins,
  outs: makeOuts,
  potOdds: makePotOdds,
  compare: makeCompare,
  preflop: makePreflop,
  luz: makeLuz,
  gto: makeGto,
  // Solo Hold'em largo (la fuente): el juego no cambia nada. Mitad "te suben", mitad "te resuben".
  preflopVs: (_v: Variant, rng: Rng = Math.random) => makePreflopVs(rng() < 0.5 ? "vsOpen" : "vs3bet", rng),
  betOrCheck: makeBetOrCheck,
  semiBluff: (v: Variant, rng: Rng = Math.random) => makeSemiBluff(v, rng),
  shove: (v: Variant, rng: Rng = Math.random) => makeShove(v, rng),
  callDown: (v: Variant, rng: Rng = Math.random) => makeCallDown(v, rng),
} satisfies Record<DrillId, (v: Variant, rng?: Rng) => unknown>

export type DailyQuestion =
  | { drill: "usable"; variant: Variant; data: ReturnType<typeof makeUsable> }
  | { drill: "whoWins"; variant: Variant; data: ReturnType<typeof makeWhoWins> }
  | { drill: "outs"; variant: Variant; data: ReturnType<typeof makeOuts> }
  | { drill: "potOdds"; variant: Variant; data: ReturnType<typeof makePotOdds> }
  | { drill: "compare"; variant: Variant; data: ReturnType<typeof makeCompare> }
  | { drill: "preflop"; variant: Variant; data: ReturnType<typeof makePreflop> }
  | { drill: "luz"; variant: Variant; data: ReturnType<typeof makeLuz> }
  | { drill: "gto"; variant: Variant; data: ReturnType<typeof makeGto> }
  | { drill: "preflopVs"; variant: Variant; data: ReturnType<typeof makePreflopVs> }
  | { drill: "betOrCheck"; variant: Variant; data: ReturnType<typeof makeBetOrCheck> }
  | { drill: "semiBluff"; variant: Variant; data: ReturnType<typeof makeSemiBluff> }
  | { drill: "shove"; variant: Variant; data: ReturnType<typeof makeShove> }
  | { drill: "callDown"; variant: Variant; data: ReturnType<typeof makeCallDown> }

/**
 * Ejercicios que entran en el desafío de una fecha. GTO se sumó después: los
 * días anteriores tienen que seguir dando las mismas preguntas (el resultado
 * se vuelve a generar desde la semilla al tocar "Ver").
 */
export const GTO_IN_DAILY_FROM = "2026-11-25"
/**
 * Ejercicios en Beta: se pueden practicar pero no entran al desafío. Son los de
 * valor esperado (nunca entraron: iban a empezar el 26/11). Para sacar uno de
 * Beta y sumarlo al desafío, usar una fecha de entrada como GTO_IN_DAILY_FROM.
 */
export const BETA_DRILLS: readonly DrillId[] = ["betOrCheck", "semiBluff", "shove", "callDown"]
/** Nunca entran al desafío: "Te suben" (solo Hold'em largo, y el desafío sortea el juego) y los Beta. */
export const NOT_IN_DAILY: readonly DrillId[] = ["preflopVs", ...BETA_DRILLS]
export function dailyDrills(date: string): readonly DrillId[] {
  const drills = DRILL_IDS.filter((d) => !NOT_IN_DAILY.includes(d))
  return date < GTO_IN_DAILY_FROM ? drills.filter((d) => d !== "gto") : drills
}

/**
 * Las preguntas del Desafío del día. Salen de una semilla armada con la
 * fecha, así que todo el grupo recibe exactamente las mismas.
 */
export function dailyChallenge(date: string): DailyQuestion[] {
  const rng = seededRng(hash(`la-cajita:${date}`))
  const games = ["holdem", "omaha", "manhattan"] as const
  const questions: DailyQuestion[] = []
  const drills = dailyDrills(date)
  for (let i = 0; i < DAILY_LENGTH; i++) {
    const drill = drills[Math.floor(rng() * drills.length)]
    const variant: Variant = {
      game: games[Math.floor(rng() * games.length)],
      deck: rng() < 0.5 ? "long" : "short",
    }
    const data = MAKERS[drill](variant, rng)
    questions.push({ drill, variant, data } as DailyQuestion)
  }
  return questions
}

/** Consejo para el ejercicio en el que más te equivocaste en el desafío. */
export const DRILL_TIPS: Record<DrillId, string> = {
  usable:
    "Antes de responder, fijate cuántas cartas de tu mano podés usar: en Omaha 2 sí o sí, en Manhattan 2 o 3. No todo lo que ves en la mesa se puede armar.",
  whoWins:
    "Armá la mejor mano de 5 de cada jugador antes de comparar. Y ojo en Short: el color le gana al full.",
  outs: "Contá solo las cartas que te ponen adelante del rival: algunas te mejoran la mano pero igual perdés.",
  potOdds:
    "Para hacer call tenés que ganar al menos apuesta ÷ (pozo + 2 × apuesta). Contra apuestas chicas alcanza con pocas chances.",
  compare:
    "Fijate qué cartas comparten las dos manos: si una domina a la otra (A-K contra A-Q), la de la carta más alta gana mucho más seguido. En Omaha suman los dos palos y las cartas seguidas.",
  luz: "Si nadie apostó, nunca hagas fold: con check ves el flop gratis. Y como el pozo ya tiene las luces, para hacer call alcanza con menos chances.",
  gto: "Si el rival apuesta B con pozo P, tenés que seguir con al menos P ÷ (P + B) de tus manos. Y al apostar, cuanto más grande la apuesta, más bluffs podés tener.",
  preflop:
    "Cuanto más tarde hablás, con más manos podés subir: hablando 1º se juega el 13% de las manos y repartiendo, el 62%.",
  betOrCheck:
    "Contá 10 veces de cada opción: pasando sumá los pozos que ganás; apostando sumá cuando foldea y cuando paga y ganás, y restá cuando paga y perdés o te sube. Gana la que da más.",
  semiBluff:
    "Las manos a las que su bluff les gana igual no sirven para pagar. Sacalas de tus 100 y defendé la parte de siempre de las que quedan. Y si sabés que farolea poco, olvidate de la defensa mínima: mirá tus pot odds.",
  shove:
    "Contá 10 all-ins: sumá las luces de las veces que foldean todos y lo que ganás cuando te pagan, y restá lo que perdés. Si da positivo, all-in; si no, fold (que da $0).",
  callDown:
    "Seguí sus 100 manos calle por calle: en cada una sigue con su defensa mínima de las que le quedaban. Al river llegan pocas, y las que nunca foldean siguen siendo las mismas: pasan a ser buena parte de lo que queda.",
  preflopVs:
    "Contra una subida de los primeros lugares se paga y se resube con poco; contra el que reparte o la ciega chica, con mucho más. Y con algunos ases y reyes se paga a propósito, para disimular.",
}

export interface DailySummary {
  score: number
  total: number
  /** Ejercicio con más errores (null si no hubo errores). */
  weakest: DrillId | null
  title: string
}

/** Resumen del desafío: puntaje, título y en qué ejercicio fallaste más. */
export function summarizeDaily(drills: readonly DrillId[], answers: readonly boolean[]): DailySummary {
  const score = answers.filter(Boolean).length
  const total = drills.length
  const misses = new Map<DrillId, number>()
  answers.forEach((ok, i) => {
    if (!ok) misses.set(drills[i], (misses.get(drills[i]) ?? 0) + 1)
  })
  let weakest: DrillId | null = null
  for (const [d, n] of misses) if (weakest === null || n > misses.get(weakest)!) weakest = d
  const ratio = total ? score / total : 0
  const title =
    ratio === 1
      ? "¡Perfecto!"
      : ratio >= 0.8
        ? "¡Muy bien!"
        : ratio >= 0.6
          ? "Bien jugado"
          : ratio >= 0.4
            ? "Se puede mejorar"
            : "A seguir practicando"
  return { score, total, weakest, title }
}

// ── Gamificación: nivel y meta del día ─────────────────────────────────────

/** Respuestas por día que completan la meta (el anillo de "Hoy"). */
export const DAILY_GOAL = 20

/** Aciertos acumulados para llegar a cada nivel (nivel 1 = 0). Después, +300 por nivel. */
const LEVEL_AT = [0, 20, 50, 100, 175, 275, 400, 550, 750, 1000]
const LEVEL_TITLES: [number, string][] = [
  [1, "Pez"],
  [3, "Aficionado"],
  [5, "Regular"],
  [7, "Tiburón"],
  [9, "Leyenda"],
]

const levelStart = (level: number) =>
  level <= LEVEL_AT.length ? LEVEL_AT[level - 1] : LEVEL_AT[LEVEL_AT.length - 1] + (level - LEVEL_AT.length) * 300

export interface LevelInfo {
  level: number
  title: string
  /** Aciertos dentro del nivel actual y cuántos hacen falta para pasar al siguiente. */
  into: number
  span: number
}

/** Nivel según los aciertos acumulados (cada acierto suma 1). */
export function levelFor(right: number): LevelInfo {
  let level = 1
  while (levelStart(level + 1) <= right) level++
  const start = levelStart(level)
  const title = LEVEL_TITLES.filter(([from]) => from <= level).at(-1)![1]
  return { level, title, into: right - start, span: levelStart(level + 1) - start }
}

// ── Calle y lugar de cada respuesta ─────────────────────────────────────────

export const STREETS = ["preflop", "flop", "turn", "river"] as const
export type TrainingStreet = (typeof STREETS)[number]
export const STREET_NAMES: Record<TrainingStreet, string> = {
  preflop: "Antes del flop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
}

/** Lugar en la mesa (solo "Antes del flop"): cuándo hablás. */
export const SEATS = ["primero", "medio", "reparte", "ciega"] as const
export type TrainingSeat = (typeof SEATS)[number]
export const SEAT_NAMES: Record<TrainingSeat, string> = {
  primero: "Hablando primero",
  medio: "En el medio",
  reparte: "Repartiendo",
  ciega: "En una ciega",
}

/**
 * Calle de los ejercicios que siempre son en la misma (sirve también para las
 * respuestas viejas, que no la guardaron). Outs y ¿Call o fold? pueden ser en
 * flop o turn: esos no se deducen.
 */
export const FIXED_STREET: Partial<Record<DrillId, TrainingStreet>> = {
  usable: "river",
  whoWins: "river",
  gto: "river",
  compare: "preflop",
  preflop: "preflop",
  luz: "preflop",
  preflopVs: "preflop",
  betOrCheck: "river",
  shove: "preflop",
  callDown: "river",
}

/** Calle y lugar de una situación ya generada, para guardarlos con la respuesta. */
export function answerContext(data: unknown): { street: TrainingStreet | null; seat: TrainingSeat | null } {
  const d = data as {
    kind?: string
    street?: string
    seat?: number
    players?: number
    pos?: string
    table?: 4 | 5 | 6
    hero?: unknown
  }
  const kind = d?.kind as DrillId | undefined
  if (!kind) return { street: null, seat: null }
  if (kind === "outs" || kind === "potOdds" || kind === "semiBluff") {
    return { street: d.street === "flop" || d.street === "turn" ? d.street : null, seat: null }
  }
  const street = FIXED_STREET[kind] ?? null
  if (kind === "luz" && d.seat && d.players) {
    return { street, seat: d.seat === d.players ? "reparte" : d.seat === 1 ? "primero" : "medio" }
  }
  if (kind === "preflopVs" && d.hero) {
    const h = d.hero as string
    return { street, seat: h === "UTG" ? "primero" : h === "BU" ? "reparte" : h === "SB" || h === "BB" ? "ciega" : "medio" }
  }
  if (kind === "preflop" && d.pos && d.table) {
    const seat: TrainingSeat =
      d.pos === "BU" ? "reparte" : d.pos === "SB" ? "ciega" : POSITIONS_BY_TABLE[d.table][0] === d.pos ? "primero" : "medio"
    return { street, seat }
  }
  return { street, seat: null }
}

/** Lunes de la semana de una fecha (YYYY-MM-DD), como `date_trunc('week')` de Postgres. */
export function weekStart(date: string): string {
  const d = new Date(`${date}T12:00:00Z`)
  const dow = (d.getUTCDay() + 6) % 7 // lunes = 0
  return addDays(date, -dow)
}

// ── Tus puntos débiles ──────────────────────────────────────────────────────

/** Respuestas mínimas de un ejercicio en un juego para sacar conclusiones. */
export const WEAK_MIN_ANSWERS = 10

export interface WeakSpot {
  drill: DrillId
  variant: Variant
  right: number
  total: number
  /** Parte de las respuestas que fueron error (0–1). */
  miss: number
}

/** Clave de ejercicio × juego × mazo, como la arma la base: "potOdds:omaha:short". */
export const drillVariantKey = (drill: DrillId, v: Variant) => `${drill}:${v.game}:${v.deck}`

const GAME_SET = new Set(["holdem", "omaha", "manhattan"])

/**
 * Los ejercicios × juego en que más fallás: solo los que tienen al menos
 * `min` respuestas y algún error, ordenados por % de error (y, a igual %, por
 * más respuestas).
 */
export function weakSpots(
  byDrillVariant: Record<string, { right: number; total: number }>,
  { min = WEAK_MIN_ANSWERS, limit = 3 }: { min?: number; limit?: number } = {},
): WeakSpot[] {
  const spots: WeakSpot[] = []
  for (const [key, t] of Object.entries(byDrillVariant)) {
    const [drill, game, deck] = key.split(":")
    if (!(DRILL_IDS as readonly string[]).includes(drill) || !GAME_SET.has(game) || (deck !== "long" && deck !== "short"))
      continue
    if (t.total < min || t.right >= t.total) continue
    spots.push({
      drill: drill as DrillId,
      variant: { game: game as Variant["game"], deck },
      right: t.right,
      total: t.total,
      miss: 1 - t.right / t.total,
    })
  }
  spots.sort((a, b) => b.miss - a.miss || b.total - a.total)
  return spots.slice(0, limit)
}

/**
 * Qué ejercicio y juego toca en cada pregunta de "Practicar lo que más fallo":
 * se sortea entre tus puntos débiles, con más chances el que más fallás.
 */
export function practicePlan(
  spots: readonly WeakSpot[],
  rng: () => number,
  length = DAILY_LENGTH,
): { drill: DrillId; variant: Variant }[] {
  if (spots.length === 0) return []
  const total = spots.reduce((a, s) => a + s.miss, 0)
  return Array.from({ length }, () => {
    let r = rng() * total
    const s = spots.find((sp) => (r -= sp.miss) < 0) ?? spots[spots.length - 1]
    return { drill: s.drill, variant: s.variant }
  })
}

/** Las preguntas de la práctica (al azar, no es igual para todos como el desafío). */
export function practiceSession(
  spots: readonly WeakSpot[],
  rng: () => number = Math.random,
  difficulty: Difficulty = "media",
): DailyQuestion[] {
  return practicePlan(spots, rng).map(({ drill, variant }) => {
    const make = withDifficulty(drill, MAKERS[drill] as (v: Variant, rng?: () => number) => { kind: string }, difficulty)
    return { drill, variant, data: make(variant, rng) } as DailyQuestion
  })
}
