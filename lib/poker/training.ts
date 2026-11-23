// Lógica pura del progreso y del Desafío del día (sin base de datos).

import { seededRng } from "./cards"
import { makeCompare, makeLuz, makeOuts, makePotOdds, makePreflop, makeUsable, makeWhoWins } from "./drills"
import type { Variant } from "./variants"

export const DRILL_IDS = ["usable", "whoWins", "outs", "potOdds", "compare", "preflop", "luz"] as const
export type DrillId = (typeof DRILL_IDS)[number]

export const DRILL_NAMES: Record<DrillId, string> = {
  usable: "¿Qué tenés?",
  whoWins: "¿Quién gana?",
  outs: "Outs",
  potOdds: "¿Pagás?",
  compare: "¿Cuál es mejor?",
  preflop: "¿Abrís? (ciegas)",
  luz: "Con luz",
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

const MAKERS = { usable: makeUsable, whoWins: makeWhoWins, outs: makeOuts, potOdds: makePotOdds, compare: makeCompare, preflop: makePreflop, luz: makeLuz }

export type DailyQuestion =
  | { drill: "usable"; variant: Variant; data: ReturnType<typeof makeUsable> }
  | { drill: "whoWins"; variant: Variant; data: ReturnType<typeof makeWhoWins> }
  | { drill: "outs"; variant: Variant; data: ReturnType<typeof makeOuts> }
  | { drill: "potOdds"; variant: Variant; data: ReturnType<typeof makePotOdds> }
  | { drill: "compare"; variant: Variant; data: ReturnType<typeof makeCompare> }
  | { drill: "preflop"; variant: Variant; data: ReturnType<typeof makePreflop> }
  | { drill: "luz"; variant: Variant; data: ReturnType<typeof makeLuz> }

/**
 * Las preguntas del Desafío del día. Salen de una semilla armada con la
 * fecha, así que todo el grupo recibe exactamente las mismas.
 */
export function dailyChallenge(date: string): DailyQuestion[] {
  const rng = seededRng(hash(`la-cajita:${date}`))
  const games = ["holdem", "omaha", "manhattan"] as const
  const questions: DailyQuestion[] = []
  for (let i = 0; i < DAILY_LENGTH; i++) {
    const drill = DRILL_IDS[Math.floor(rng() * DRILL_IDS.length)]
    const variant: Variant = {
      game: games[Math.floor(rng() * games.length)],
      deck: rng() < 0.5 ? "long" : "short",
    }
    const data = MAKERS[drill](variant, rng)
    questions.push({ drill, variant, data } as DailyQuestion)
  }
  return questions
}
