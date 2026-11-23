// "¿Abrís?" BETA para Hold'em short, Omaha y Manhattan.
//
// No hay una fuente confiable con rangos de apertura para estos juegos, así
// que los INFERIMOS: ordenamos las manos por su equity contra 2 manos al azar
// y en cada posición abrimos el mismo porcentaje que la fuente de Hold'em
// (UTG 13%, MP 17%, CO 32%, BU 62%, SB 31%).
//
// Probado en Hold'em largo contra la fuente real: el método coincide en el
// 84–94% de las combinaciones según la posición, pero falla justo en manos de
// borde (subestima pares chicos y conectores del mismo palo, sobrestima ases
// y reyes de distinto palo). Por eso se muestra como Beta.
//
// Los números de BETA_DATA salen de scripts/gen-preflop-beta.ts (simulación
// con semilla fija); para regenerarlos: `npx tsx scripts/gen-preflop-beta.ts`.

import { remainingDeck, type Card, type Rng } from "./cards"
import { bestScore } from "./evaluator"
import { BETA_DATA } from "./preflop-beta-data"
import { OPEN_RANGES, type HandClass, type Position } from "./preflop"
import { GAMES, type Variant } from "./variants"

/** Rivales contra los que se mide la equity. */
export const BETA_OPPONENTS = 2

/** Coincidencia del método con la fuente en Hold'em largo, por posición (combinaciones en que coinciden). */
export const BETA_VALIDATION: Record<Position, number> = BETA_DATA.validation

export const variantKey = (v: Variant) => `${v.game}:${v.deck}` as const

/** Fracción de manos que se abre en cada posición (la misma que la fuente de Hold'em). */
export const openFraction = (pos: Position) => OPEN_RANGES[pos].combos / 1326

/** Equity de `hand` contra `opponents` manos al azar (Monte Carlo). */
export function equityVsRandom(hand: readonly Card[], v: Variant, trials: number, rng: Rng, opponents = BETA_OPPONENTS): number {
  const hole = GAMES[v.game].holeCount
  const rest = remainingDeck(v.deck, hand)
  const need = opponents * hole + 5
  const board = new Array<Card>(5)
  const opp = Array.from({ length: opponents }, () => new Array<Card>(hole))
  let eq = 0
  for (let t = 0; t < trials; t++) {
    for (let i = 0; i < need; i++) {
      const j = i + Math.floor(rng() * (rest.length - i))
      const tmp = rest[i]
      rest[i] = rest[j]
      rest[j] = tmp
    }
    let k = 0
    for (const o of opp) for (let i = 0; i < hole; i++) o[i] = rest[k++]
    for (let i = 0; i < 5; i++) board[i] = rest[k++]
    const mine = bestScore(hand, board, v.game, v.deck)
    const best = mine
    let ties = 1
    let lost = false
    for (const o of opp) {
      const s = bestScore(o, board, v.game, v.deck)
      if (s > best) {
        lost = true
        break
      } else if (s === best) ties++
    }
    if (!lost) eq += 1 / ties
  }
  return eq / trials
}

/** Equity mínima para abrir en cada posición, por juego (de BETA_DATA). */
export function betaThreshold(v: Variant, pos: Position): number {
  return BETA_DATA.thresholds[variantKey(v)][pos]
}

/** Equity de cada casilla de la grilla 9×9 de Hold'em short. */
export const SHORT_GRID_EQUITY: Record<HandClass, number> = BETA_DATA.shortGrid

/** Hold'em short: abre si su equity está entre las mejores del porcentaje de la posición. */
export function shortOpens(cls: HandClass, pos: Position): boolean {
  return SHORT_GRID_EQUITY[cls] >= betaThreshold({ game: "holdem", deck: "short" }, pos)
}
