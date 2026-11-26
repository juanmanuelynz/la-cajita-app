// Genera lib/poker/preflop-beta-data.ts (datos del "¿Abrís?" BETA).
// Uso: npx tsx scripts/gen-preflop-beta.ts   (tarda unos minutos)
//
// 1. Hold'em largo: equity de las 169 manos contra 2 al azar; se abre el top
//    de cada posición y se compara con la fuente real (validación del método).
// 2. Hold'em short: lo mismo con las 81 manos de la grilla 9×9.
//    (Las dos grillas se guardan: los bots las usan para leer rangos.)
// 3. Omaha y Manhattan (long/short): se reparten manos al azar, se mide su
//    equity y se toma el umbral que deja arriba el % de cada posición.

import { writeFileSync } from "node:fs"
import { makeCard, remainingDeck, seededRng, shuffle, type DeckType } from "../lib/poker/cards"
import { equityVsRandom, openFraction } from "../lib/poker/preflop-beta"
import { comboCount, gridClasses, openRange, type HandClass, type Position } from "../lib/poker/preflop"
import type { GameId, Variant } from "../lib/poker/variants"

const POSITIONS: Position[] = ["UTG", "MP", "CO", "BU", "SB"]
const R = "23456789TJQKA"
const round = (x: number) => Math.round(x * 10000) / 10000

function classCards(cls: HandClass) {
  const hi = R.indexOf(cls[0]) + 2
  const lo = R.indexOf(cls[1]) + 2
  return cls.endsWith("s") ? [makeCard(hi, 0), makeCard(lo, 0)] : [makeCard(hi, 0), makeCard(lo, 1)]
}

function gridEquities(deck: DeckType, trials: number) {
  const min = deck === "short" ? 6 : 2
  const classes = gridClasses()
    .flat()
    .filter((c) => R.indexOf(c[0]) + 2 >= min && R.indexOf(c[1]) + 2 >= min)
  const rng = seededRng(deck === "short" ? 606 : 202)
  const v: Variant = { game: "holdem", deck }
  return Object.fromEntries(classes.map((c) => [c, round(equityVsRandom(classCards(c), v, trials, rng))]))
}

/** Umbral de cada posición: equity de la última mano que entra en el top. */
function gridThresholds(eq: Record<HandClass, number>, totalCombos: number) {
  const sorted = Object.entries(eq).sort((a, b) => b[1] - a[1])
  const out = {} as Record<Position, number>
  for (const pos of POSITIONS) {
    const target = openFraction(pos) * totalCombos
    let n = 0
    let last = 1
    for (const [c, e] of sorted) {
      if (n >= target) break
      n += comboCount(c)
      last = e
    }
    out[pos] = last
  }
  return out
}

function sampledThresholds(game: GameId, deck: DeckType, hands: number, trials: number) {
  const v: Variant = { game, deck }
  const rng = seededRng(game.length * 1000 + (deck === "short" ? 7 : 3))
  const holeCount = game === "omaha" ? 4 : 5
  const eqs: number[] = []
  for (let i = 0; i < hands; i++) {
    const hand = shuffle(remainingDeck(deck, []), rng).slice(0, holeCount)
    eqs.push(equityVsRandom(hand, v, trials, rng))
  }
  eqs.sort((a, b) => b - a)
  const out = {} as Record<Position, number>
  for (const pos of POSITIONS) out[pos] = round(eqs[Math.max(0, Math.round(openFraction(pos) * hands) - 1)])
  return out
}

const t0 = Date.now()
const log = (m: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`)

const longGrid = gridEquities("long", 20000)
const longThr = gridThresholds(longGrid, 1326)
const validation = {} as Record<Position, number>
for (const pos of POSITIONS) {
  const src = openRange(pos)
  let agree = 0
  for (const [c, e] of Object.entries(longGrid)) if ((e >= longThr[pos]) === src.has(c)) agree += comboCount(c)
  validation[pos] = round(agree / 1326)
}
log(`validación Hold'em largo: ${JSON.stringify(validation)}`)

const shortGrid = gridEquities("short", 20000)
const thresholds: Record<string, Record<Position, number>> = {
  "holdem:short": gridThresholds(shortGrid, 630),
}
log("Hold'em short listo")
for (const game of ["omaha", "manhattan"] as const) {
  for (const deck of ["long", "short"] as const) {
    thresholds[`${game}:${deck}`] = game === "omaha" ? sampledThresholds(game, deck, 1500, 1500) : sampledThresholds(game, deck, 1000, 1000)
    log(`${game}:${deck} listo ${JSON.stringify(thresholds[`${game}:${deck}`])}`)
  }
}

const out = `// GENERADO por scripts/gen-preflop-beta.ts — no editar a mano.
// Equity contra 2 manos al azar (Monte Carlo con semilla fija).

import type { Position } from "./preflop"

export const BETA_DATA: {
  validation: Record<Position, number>
  thresholds: Record<string, Record<Position, number>>
  shortGrid: Record<string, number>
  longGrid: Record<string, number>
} = ${JSON.stringify({ validation, thresholds, shortGrid, longGrid }, null, 2)}
`
writeFileSync(new URL("../lib/poker/preflop-beta-data.ts", import.meta.url), out)
log("escrito lib/poker/preflop-beta-data.ts")
