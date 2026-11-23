// Equity (qué parte del pozo se lleva cada mano en promedio) y outs.
// Exacta cuando las combinaciones de mesa que faltan son pocas; si no, por
// simulación (Monte Carlo).

import { remainingDeck, shuffle, type Card, type Rng } from "./cards"
import { bestScore, combos } from "./evaluator"
import type { Variant } from "./variants"

export interface EquityResult {
  /** Parte del pozo que se lleva cada jugador, 0..1 (los empates reparten). */
  equity: number[]
  /** Probabilidad de ganar solo. */
  win: number[]
  /** Probabilidad de empatar (repartir) con alguien. */
  tie: number[]
  /** Mesas evaluadas. */
  samples: number
  exact: boolean
}

/** Puntajes de cada jugador con una mesa completa. */
function scores(holes: readonly Card[][], board: readonly Card[], v: Variant): number[] {
  return holes.map((h) => bestScore(h, board, v.game, v.deck))
}

class Tally {
  equity: number[]
  win: number[]
  tie: number[]
  samples = 0
  constructor(n: number) {
    this.equity = new Array(n).fill(0)
    this.win = new Array(n).fill(0)
    this.tie = new Array(n).fill(0)
  }
  add(sc: number[]) {
    let best = -1
    let nBest = 0
    for (const s of sc) {
      if (s > best) {
        best = s
        nBest = 1
      } else if (s === best) nBest++
    }
    for (let i = 0; i < sc.length; i++) {
      if (sc[i] !== best) continue
      this.equity[i] += 1 / nBest
      if (nBest === 1) this.win[i]++
      else this.tie[i]++
    }
    this.samples++
  }
  result(exact: boolean): EquityResult {
    const n = this.samples || 1
    return {
      equity: this.equity.map((x) => x / n),
      win: this.win.map((x) => x / n),
      tie: this.tie.map((x) => x / n),
      samples: this.samples,
      exact,
    }
  }
}

function binom(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let r = 1
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i
  return Math.round(r)
}

/** Cuántas mesas distintas hay que evaluar para la equity exacta. */
export function exactBoardCount(holes: readonly Card[][], board: readonly Card[], v: Variant): number {
  const used = holes.flat().length + board.length
  const deck = v.deck === "short" ? 36 : 52
  return binom(deck - used, 5 - board.length)
}

/** Equity exacta: recorre todas las mesas posibles. */
export function equityExact(holes: readonly Card[][], board: readonly Card[], v: Variant): EquityResult {
  const rest = remainingDeck(v.deck, [...holes.flat(), ...board])
  const need = 5 - board.length
  const tally = new Tally(holes.length)
  if (need === 0) {
    tally.add(scores(holes, board, v))
    return tally.result(true)
  }
  const full = board.slice()
  for (const c of combos(rest.length, need)) {
    full.length = board.length
    for (const i of c) full.push(rest[i])
    tally.add(scores(holes, full, v))
  }
  return tally.result(true)
}

/** Equity por simulación: `trials` mesas al azar. */
export function equityMonteCarlo(
  holes: readonly Card[][],
  board: readonly Card[],
  v: Variant,
  trials: number,
  rng: Rng = Math.random,
): EquityResult {
  const tally = new Tally(holes.length)
  runTrials(tally, holes, board, v, trials, rng)
  return tally.result(false)
}

function runTrials(tally: Tally, holes: readonly Card[][], board: readonly Card[], v: Variant, trials: number, rng: Rng) {
  const rest = remainingDeck(v.deck, [...holes.flat(), ...board])
  const need = 5 - board.length
  const full = board.slice()
  for (let t = 0; t < trials; t++) {
    // Fisher–Yates parcial: solo las `need` primeras posiciones.
    for (let i = 0; i < need; i++) {
      const j = i + Math.floor(rng() * (rest.length - i))
      const tmp = rest[i]
      rest[i] = rest[j]
      rest[j] = tmp
    }
    full.length = board.length
    for (let i = 0; i < need; i++) full.push(rest[i])
    tally.add(scores(holes, full, v))
  }
}

/** Hasta cuántas mesas conviene hacer la cuenta exacta (según el juego). */
const EXACT_LIMIT = { holdem: 60000, omaha: 15000, manhattan: 6000 } as const

/** Equity exacta si son pocas mesas; si no, simulación. */
export function computeEquity(
  holes: readonly Card[][],
  board: readonly Card[],
  v: Variant,
  { trials = 20000, rng = Math.random }: { trials?: number; rng?: Rng } = {},
): EquityResult {
  if (exactBoardCount(holes, board, v) <= EXACT_LIMIT[v.game]) return equityExact(holes, board, v)
  return equityMonteCarlo(holes, board, v, trials, rng)
}

/**
 * Igual que `computeEquity` pero sin congelar la pantalla: simula de a tandas
 * y cede el control entre tandas. Corta a los `budgetMs` o `maxTrials`.
 */
export async function computeEquityAsync(
  holes: readonly Card[][],
  board: readonly Card[],
  v: Variant,
  {
    budgetMs = 1500,
    maxTrials = 50000,
    onProgress,
    signal,
  }: { budgetMs?: number; maxTrials?: number; onProgress?: (r: EquityResult) => void; signal?: { cancelled: boolean } } = {},
): Promise<EquityResult> {
  if (exactBoardCount(holes, board, v) <= EXACT_LIMIT[v.game]) return equityExact(holes, board, v)
  const tally = new Tally(holes.length)
  const start = performance.now()
  const batch = v.game === "holdem" ? 2000 : v.game === "omaha" ? 500 : 150
  while (tally.samples < maxTrials && performance.now() - start < budgetMs) {
    runTrials(tally, holes, board, v, batch, Math.random)
    onProgress?.(tally.result(false))
    await new Promise((r) => setTimeout(r, 0))
    if (signal?.cancelled) break
  }
  return tally.result(false)
}

// ── Outs ───────────────────────────────────────────────────────────────────

export interface OutsResult {
  /** Cartas que te ponen adelante en la próxima calle. */
  outs: Card[]
  /** Cartas que te dejan empatado. */
  ties: Card[]
  /** Cartas que quedan en el mazo (sin las dos manos ni la mesa). */
  unseen: number
}

/**
 * Outs de `hero` contra `villain` (cartas a la vista) para la próxima carta.
 * La mesa tiene que tener 3 o 4 cartas.
 */
export function countOuts(hero: readonly Card[], villain: readonly Card[], board: readonly Card[], v: Variant): OutsResult {
  const rest = remainingDeck(v.deck, [...hero, ...villain, ...board])
  const outs: Card[] = []
  const ties: Card[] = []
  const next = board.slice()
  for (const c of rest) {
    next.length = board.length
    next.push(c)
    const h = bestScore(hero, next, v.game, v.deck)
    const vi = bestScore(villain, next, v.game, v.deck)
    if (h > vi) outs.push(c)
    else if (h === vi) ties.push(c)
  }
  return { outs, ties, unseen: rest.length }
}

/** Reparte `players` manos y `boardCount` cartas de mesa al azar. */
export function deal(v: Variant, players: number, holeCount: number, boardCount: number, rng: Rng = Math.random) {
  const deck = shuffle(remainingDeck(v.deck, []), rng)
  const holes: Card[][] = []
  let i = 0
  for (let p = 0; p < players; p++) holes.push(deck.slice(i, (i += holeCount)))
  const board = deck.slice(i, i + boardCount)
  return { holes, board }
}
