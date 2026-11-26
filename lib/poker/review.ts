// Repaso de la mano (Mesa de práctica): en cada momento en que te apostaron,
// ¿pagar o irte estuvo bien? Misma cuenta que "¿Call o fold?": lo que pagás
// sobre el pozo que queda si pagás (pot odds) contra tu chance de ganar.
//
// La chance se juzga con lo que sabías en ese momento: contra las manos que
// podía tener cada rival según cómo apostó, como las lee un bot Difícil
// (`estimateRangeEquity` + `keepFor`). Al lado, de dato, la chance real contra
// sus cartas, si se vieron al final. No cuenta lo que puedas ganar después
// (como en "¿Call o fold?").

import type { Rng } from "./cards"
import { BOT_PROFILES, BOT_TRIALS, estimateRangeEquity, keepFor } from "./bot"
import { computeEquity } from "./equity"
import type { ActionLog, BettingStreet, HandState, Structure } from "./table"

/** Diferencia (en chance) por debajo de la cual pagar o irte da casi lo mismo. */
export const REVIEW_CLOSE = 0.03

/** Cartas de la mesa que había en cada calle. */
const BOARD_AT: Record<BettingStreet, number> = { preflop: 0, flop: 3, turn: 4, river: 5 }

export interface ReviewSpot {
  street: BettingStreet
  /** Índice en el log de tu decisión. */
  index: number
  /** Lo que tenías que poner para pagar. */
  toCall: number
  /** Pozo antes de pagar (con la apuesta del rival). */
  pot: number
  /** Chance mínima para que pagar convenga: toCall / (pot + toCall). */
  needed: number
  /** Qué hiciste: seguir (pagar o subir) o irte. */
  played: "call" | "raise" | "fold"
  /** Rivales que seguían en la mano en ese momento. */
  opponents: number[]
}

export interface ReviewedSpot extends ReviewSpot {
  /** Tu chance con lo que sabías (contra sus manos posibles). */
  equity: number
  /** Tu chance contra sus cartas reales (null si no se vieron todas). */
  actual: number | null
  /** "bien" / "mal" según tu decisión, o "justo" si da casi lo mismo. */
  verdict: "bien" | "mal" | "justo"
}

/**
 * Los momentos de la mano en que te apostaron (alguien apostó o subió en la
 * calle y te tocaba pagar algo). Rápido: no calcula chances.
 */
export function reviewSpots(h: HandState, seat: number, structure: Structure, bigBlind: number): ReviewSpot[] {
  // Lo que puso cada uno sin hablar (luz o ciegas) = lo comprometido menos lo del log.
  const fromLog = new Map<number, number>()
  for (const x of h.log) fromLog.set(x.seat, (fromLog.get(x.seat) ?? 0) + x.amount)
  const posted = new Map(h.players.map((p) => [p.seat, p.committed - (fromLog.get(p.seat) ?? 0)]))
  let pot = [...posted.values()].reduce((a, b) => a + b, 0)

  const folded = new Set<number>()
  const spots: ReviewSpot[] = []
  let street: BettingStreet | null = null
  let streetBet = new Map<number, number>()
  let current = 0
  let betMade = false
  h.log.forEach((x: ActionLog, i) => {
    if (x.street !== street) {
      street = x.street
      // Con ciegas, antes del flop la chica y la grande ya cuentan como apuesta de la calle (la luz no).
      streetBet = new Map(street === "preflop" && structure === "ciegas" ? [...posted] : [])
      current = street === "preflop" && structure === "ciegas" ? bigBlind : 0
      betMade = false
    }
    const mine = streetBet.get(x.seat) ?? 0
    if (x.seat === seat && betMade && current > mine && x.action !== "check") {
      const toCall = x.action === "call" || (x.action === "allIn" && x.to === undefined) ? x.amount : current - mine
      spots.push({
        street: x.street,
        index: i,
        toCall,
        pot,
        needed: toCall / (pot + toCall),
        played: x.action === "fold" ? "fold" : x.to !== undefined ? "raise" : "call",
        opponents: h.players.filter((p) => p.seat !== seat && !folded.has(p.seat)).map((p) => p.seat),
      })
    }
    pot += x.amount
    if (x.to !== undefined) {
      streetBet.set(x.seat, x.to)
      current = Math.max(current, x.to)
      betMade = true
    } else streetBet.set(x.seat, mine + x.amount)
    if (x.action === "fold") folded.add(x.seat)
  })
  return spots
}

/** Lo bueno o malo de una decisión según la chance y lo necesario. */
export function verdictFor(played: ReviewSpot["played"], equity: number, needed: number): ReviewedSpot["verdict"] {
  if (Math.abs(equity - needed) < REVIEW_CLOSE) return "justo"
  const shouldPlay = equity >= needed
  return (played !== "fold") === shouldPlay ? "bien" : "mal"
}

/** El repaso completo: chances con lo que sabías y contra las cartas reales. */
export function reviewHand(
  h: HandState,
  seat: number,
  structure: Structure,
  bigBlind: number,
  rng: Rng = Math.random,
  trials = BOT_TRIALS[h.variant.game] * 2,
): ReviewedSpot[] {
  const me = h.players.find((p) => p.seat === seat)
  if (!me) return []
  const read = BOT_PROFILES.dificil
  // Cartas de rivales que se vieron al final (los que llegaron a mostrar).
  const shown = new Set(h.result?.showdown ? h.players.filter((p) => !p.folded).map((p) => p.seat) : [])
  return reviewSpots(h, seat, structure, bigBlind).map((s) => {
    const board = h.board.slice(0, BOARD_AT[s.street])
    const before = { ...h, street: s.street, log: h.log.slice(0, s.index) }
    const ranges = s.opponents.map((o) => ({ keep: Math.pow(keepFor(before, o), read.reads), bluffMix: read.bluffMix }))
    const equity = estimateRangeEquity(me.hole, board, h.variant, ranges, trials, rng)
    let actual: number | null = null
    if (s.opponents.length > 0 && s.opponents.every((o) => shown.has(o))) {
      const holes = [me.hole, ...s.opponents.map((o) => h.players.find((p) => p.seat === o)!.hole)]
      actual = computeEquity(holes, board, h.variant, { trials: 4000, rng }).equity[0]
    }
    return { ...s, equity, actual, verdict: verdictFor(s.played, equity, s.needed) }
  })
}
