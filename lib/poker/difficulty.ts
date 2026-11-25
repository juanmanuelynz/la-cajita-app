// Dificultad según el nivel (fase 4 del plan Runout). El Desafío del día NO la
// usa: tiene que ser igual para todos.
//
// Cómo: cada ejercicio se sigue generando igual que siempre. En "media" se
// genera uno solo (como antes). En "fácil" y "difícil" se generan unos pocos
// candidatos y se elige el que más se acerca a lo buscado, según un puntaje de
// 0 (clarísimo) a 1 (muy ajustado). Comparar manos y luz simulan miles de
// manos: esos reciben el rango buscado y lo filtran con una simulación rápida.

import type { Rng } from "./cards"
import { Cat } from "./evaluator"
import {
  makeCompare,
  makeLuz,
  type CompareDrill,
  type LuzDrill,
  type OutsDrill,
  type PotOddsDrill,
  type UsableDrill,
  type WhoWinsDrill,
} from "./drills"
import type { Variant } from "./variants"

export type Difficulty = "facil" | "media" | "dificil"

export const DIFFICULTY_NAMES: Record<Difficulty, string> = { facil: "Fácil", media: "Media", dificil: "Difícil" }

/** Niveles 1–3 fácil, 4–6 media, 7 en adelante difícil. */
export function difficultyForLevel(level: number): Difficulty {
  if (level <= 3) return "facil"
  if (level <= 6) return "media"
  return "dificil"
}

/** Nivel en que empieza la próxima dificultad (null si ya es la más alta). */
export function nextDifficultyAt(d: Difficulty): number | null {
  return d === "facil" ? 4 : d === "media" ? 7 : null
}

/** Margen entre tu equity y lo necesario → puntaje (0 lejos, 1 justo arriba de "da igual"). */
function marginScore(margin: number, closeBelow: number) {
  if (margin < closeBelow) return 0.5 // "las dos valen": no es la pregunta difícil que buscamos
  return 1 - Math.min(1, (margin - closeBelow) / 0.25)
}

type Scored = UsableDrill | WhoWinsDrill | OutsDrill | PotOddsDrill

/** Qué tan difícil es una situación ya generada: 0 clarísima, 1 muy ajustada. */
export function difficultyScore(d: Scored | CompareDrill | LuzDrill | { kind: string }): number {
  switch (d.kind) {
    case "usable": {
      const u = d as UsableDrill
      // La trampa (lo que parece que tenés y no podés armar) es lo difícil.
      if (u.trap) return 1
      return u.hand.cat >= Cat.Straight ? 0.4 : 0.1
    }
    case "whoWins": {
      const w = d as WhoWinsDrill
      if (w.winners.length > 1) return 0.7 // reparten: hay que verlo
      const cats = w.hands.map((h) => h.cat).sort((a, b) => b - a)
      const diff = cats[0] - cats[1]
      return diff === 0 ? 1 : diff === 1 ? 0.5 : 0
    }
    case "outs":
      return Math.min(1, (d as OutsDrill).outs.length / 14)
    case "potOdds": {
      const p = d as PotOddsDrill
      return marginScore(Math.abs(p.equity - p.needed), 0.02)
    }
    case "compare": {
      const c = d as CompareDrill
      return 1 - Math.min(1, Math.abs(c.equity[0] - c.equity[1]) / 0.35)
    }
    case "luz": {
      const l = d as LuzDrill
      return l.bet ? marginScore(Math.abs(l.bet.equity - l.bet.needed), 0.03) : 0.2
    }
    default:
      return 0.5 // ciegas y GTO: tabla y fórmulas fijas, sin dificultad
  }
}

/** Cuentas fijas: sin dificultad (GTO y las de valor esperado). */
const NO_DIFFICULTY = new Set(["gto", "betOrCheck", "semiBluff", "shove"])

const TARGET: Record<Exclude<Difficulty, "media">, number> = { facil: 0, dificil: 1 }
const TRIES = 6

/**
 * Envuelve el generador del ejercicio `kind` para que respete la dificultad. En
 * "media" no cambia nada. Los que no tienen dificultad (ciegas, GTO) tampoco.
 */
export function withDifficulty<T extends { kind: string }>(
  kind: string,
  make: (v: Variant, rng?: Rng) => T,
  difficulty: Difficulty,
): (v: Variant, rng?: Rng) => T {
  if (difficulty === "media" || kind === "preflop" || kind === "preflopVs" || NO_DIFFICULTY.has(kind)) return make
  const easy = difficulty === "facil"
  // Los caros: el rango va directo al generador.
  if (kind === "compare")
    return (v, rng = Math.random) =>
      makeCompare(v, rng, easy ? { min: 0.3, max: 1 } : { min: 0.08, max: 0.16 }) as unknown as T
  if (kind === "luz")
    return (v, rng = Math.random) =>
      makeLuz(v, rng, easy ? { min: 0.15, max: 1 } : { min: 0.03, max: 0.08 }) as unknown as T
  const target = TARGET[difficulty]
  return (v, rng = Math.random) => {
    let best = make(v, rng)
    let bestGap = Math.abs(difficultyScore(best) - target)
    for (let i = 1; i < TRIES && bestGap > 0.15; i++) {
      const c = make(v, rng)
      const gap = Math.abs(difficultyScore(c) - target)
      if (gap < bestGap) {
        best = c
        bestGap = gap
      }
    }
    return best
  }
}
