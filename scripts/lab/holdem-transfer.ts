// Laboratorio de La Cajita, estudio 1: ¿cuánto te equivocás si pensás una mano
// de Omaha o Manhattan "como si fuera Hold'em"?
//
// Método: se reparte una situación de Hold'em mano a mano (2 cartas cada uno y
// una mesa en el flop o en el turn) y se calcula su equity exacta. Después se
// completa cada mano con cartas al azar hasta tener una de Omaha (4) o de
// Manhattan (5), conservando las 2 de Hold'em, y se calcula la equity real con
// las reglas de ese juego. La diferencia es el error de usar el número de
// Hold'em. Se repite con varias manos completadas por situación.
//
// Correr: npx tsx scripts/lab/holdem-transfer.ts [situaciones] [semilla]
// Es puro cálculo (sin base de datos) y se puede repetir: misma semilla, mismos números.

import { seededRng, shuffle, remainingDeck, type Card } from "../../lib/poker/cards"
import { equityExact, equityMonteCarlo } from "../../lib/poker/equity"
import { GAMES, type GameId, type Variant } from "../../lib/poker/variants"

const SPOTS = Number(process.argv[2] ?? 200)
const SEED = Number(process.argv[3] ?? 2026)
/** Manos completadas por situación (promedia la suerte de las cartas agregadas). */
const EXTENSIONS = 4
/** Simulaciones para el flop en Omaha/Manhattan (el turn es exacto). */
const FLOP_TRIALS = 1500
/** Equity que pide pagar una apuesta del pozo: B / (P + 2B) = 1/3. */
const POT_BET_NEEDED = 1 / 3

type Street = "flop" | "turn"

interface Row {
  game: GameId
  deck: Variant["deck"]
  street: Street
  /** Errores (equity real − equity de Hold'em), en puntos de 0 a 1, de la mano 1. */
  errors: number[]
  /** Veces en que "pago una apuesta del pozo" cambia de respuesta. */
  flips: number
  /** Veces en que la mano que va adelante en Hold'em queda atrás. */
  leaderSwaps: number
  /** Equity de Hold'em de la mano que va adelante, y la real. */
  leaderHoldem: number[]
  leaderReal: number[]
}

function equity(holes: Card[][], board: Card[], v: Variant, street: Street, rng: () => number) {
  if (v.game === "holdem" || street === "turn") return equityExact(holes, board, v).equity[0]
  return equityMonteCarlo(holes, board, v, FLOP_TRIALS, rng).equity[0]
}

function study(game: Exclude<GameId, "holdem">, deck: Variant["deck"], street: Street, rng: () => number): Row {
  const holdem: Variant = { game: "holdem", deck }
  const target: Variant = { game, deck }
  const holeCount = GAMES[game].holeCount
  const boardCount = street === "flop" ? 3 : 4
  const row: Row = { game, deck, street, errors: [], flips: 0, leaderSwaps: 0, leaderHoldem: [], leaderReal: [] }

  for (let s = 0; s < SPOTS; s++) {
    const cards = shuffle(remainingDeck(deck, []), rng)
    const a = cards.slice(0, 2)
    const b = cards.slice(2, 4)
    const board = cards.slice(4, 4 + boardCount)
    const base = equity([a, b], board, holdem, street, rng)

    let sum = 0
    for (let e = 0; e < EXTENSIONS; e++) {
      const rest = shuffle(remainingDeck(deck, [...a, ...b, ...board]), rng)
      const extra = holeCount - 2
      const a2 = [...a, ...rest.slice(0, extra)]
      const b2 = [...b, ...rest.slice(extra, 2 * extra)]
      sum += equity([a2, b2], board, target, street, rng)
    }
    const real = sum / EXTENSIONS
    row.errors.push(real - base)
    if (base >= POT_BET_NEEDED !== real >= POT_BET_NEEDED) row.flips++
    if (base !== 0.5 && base > 0.5 !== real > 0.5) row.leaderSwaps++
    const leadBase = Math.max(base, 1 - base)
    row.leaderHoldem.push(leadBase)
    row.leaderReal.push(base >= 0.5 ? real : 1 - real)
  }
  return row
}

const mean = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / xs.length
const pctl = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))]
const pts = (x: number) => `${(x * 100).toFixed(1)}`

const rng = seededRng(SEED)
const rows: Row[] = []
for (const deck of ["long", "short"] as const)
  for (const game of ["omaha", "manhattan"] as const)
    for (const street of ["flop", "turn"] as const) {
      const t = Date.now()
      rows.push(study(game, deck, street, rng))
      console.error(`${game} ${deck} ${street}: ${((Date.now() - t) / 1000).toFixed(1)}s`)
    }

console.log(`\nSituaciones por fila: ${SPOTS} · manos completadas por situación: ${EXTENSIONS} · semilla ${SEED}\n`)
console.log("| Juego | Mazo | Calle | Error medio (pts) | 9 de 10 errores menores a | Cambia «pago el pozo» | Cambia quién va adelante | El que va adelante: Hold'em → real |")
console.log("|---|---|---|---|---|---|---|---|")
for (const r of rows) {
  const abs = r.errors.map(Math.abs)
  console.log(
    `| ${GAMES[r.game].name} | ${r.deck === "long" ? "Long" : "Short"} | ${r.street} | ${pts(mean(abs))} | ${pts(pctl(abs, 0.9))} | ${((r.flips / SPOTS) * 100).toFixed(0)}% | ${((r.leaderSwaps / SPOTS) * 100).toFixed(0)}% | ${pts(mean(r.leaderHoldem))}% → ${pts(mean(r.leaderReal))}% |`,
  )
}
