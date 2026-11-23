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
  potOdds: "¿Call o fold?",
  compare: "¿Cuál es mejor?",
  preflop: "Antes del flop (ciegas)",
  luz: "Antes del flop (luz)",
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
