// Lógica pura del progreso y del Desafío del día (sin base de datos).

import { seededRng } from "./cards"
import { makeGto } from "./gto"
import { makeCompare, makeLuz, makeOuts, makePotOdds, makePreflop, makeUsable, makeWhoWins } from "./drills"
import type { Variant } from "./variants"

export const DRILL_IDS = ["usable", "whoWins", "outs", "potOdds", "compare", "preflop", "luz", "gto"] as const
export type DrillId = (typeof DRILL_IDS)[number]

export const DRILL_NAMES: Record<DrillId, string> = {
  usable: "¿Qué tenés?",
  whoWins: "¿Quién gana?",
  outs: "Outs",
  potOdds: "¿Call o fold?",
  compare: "¿Cuál es mejor?",
  preflop: "Antes del flop (ciegas)",
  luz: "Antes del flop (luz)",
  gto: "GTO en el river",
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

const MAKERS = { usable: makeUsable, whoWins: makeWhoWins, outs: makeOuts, potOdds: makePotOdds, compare: makeCompare, preflop: makePreflop, luz: makeLuz, gto: makeGto }

export type DailyQuestion =
  | { drill: "usable"; variant: Variant; data: ReturnType<typeof makeUsable> }
  | { drill: "whoWins"; variant: Variant; data: ReturnType<typeof makeWhoWins> }
  | { drill: "outs"; variant: Variant; data: ReturnType<typeof makeOuts> }
  | { drill: "potOdds"; variant: Variant; data: ReturnType<typeof makePotOdds> }
  | { drill: "compare"; variant: Variant; data: ReturnType<typeof makeCompare> }
  | { drill: "preflop"; variant: Variant; data: ReturnType<typeof makePreflop> }
  | { drill: "luz"; variant: Variant; data: ReturnType<typeof makeLuz> }
  | { drill: "gto"; variant: Variant; data: ReturnType<typeof makeGto> }

/**
 * Ejercicios que entran en el desafío de una fecha. GTO se sumó después: los
 * días anteriores tienen que seguir dando las mismas preguntas (el resultado
 * se vuelve a generar desde la semilla al tocar "Ver").
 */
export const GTO_IN_DAILY_FROM = "2026-11-25"
export function dailyDrills(date: string): readonly DrillId[] {
  return date < GTO_IN_DAILY_FROM ? DRILL_IDS.filter((d) => d !== "gto") : DRILL_IDS
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
export function practiceSession(spots: readonly WeakSpot[], rng: () => number = Math.random): DailyQuestion[] {
  return practicePlan(spots, rng).map(
    ({ drill, variant }) => ({ drill, variant, data: MAKERS[drill](variant, rng) }) as DailyQuestion,
  )
}
