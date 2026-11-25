// Bots de "Jugar contra bots" (ver docs/plan-jugar-contra-bots.md).
//
// Deciden igual en todos los juegos y en todas las calles, como el ejercicio
// "Con luz": simulan su chance de ganar (equity) contra los que siguen en la
// mano, con cartas al azar (no ven las de nadie), y la comparan con lo que
// tienen que pagar (pot odds). Es una regla nuestra, sin fuente: en la pantalla
// van con la etiqueta Beta. Los rangos de PokerStrategy no se usan porque son
// para mesas con ciegas y acá se juega con luz.
//
// Para que no sean 100% previsibles: a veces farolean, a veces juegan lento una
// mano muy buena y el tamaño de la apuesta varía un poco.

import { remainingDeck, type Card, type Rng } from "./cards"
import { bestScore } from "./evaluator"
import { act, canRequestCajita, legalActions, potTotal, type Action, type Legal, type TableState } from "./table"
import { GAMES, type Variant } from "./variants"

/** Simulaciones por decisión: Manhattan cuesta más por mano, así que simula menos. */
export const BOT_TRIALS: Record<Variant["game"], number> = { holdem: 600, omaha: 300, manhattan: 160 }

/**
 * Chance de ganar con `hole` contra `opponents` manos al azar, con la mesa que
 * hay (lo que falta sale al azar). Los empates cuentan a partes iguales.
 */
export function estimateEquity(
  hole: readonly Card[],
  board: readonly Card[],
  v: Variant,
  opponents: number,
  trials: number,
  rng: Rng,
): number {
  if (opponents <= 0) return 1
  const holeCount = GAMES[v.game].holeCount
  const rest = remainingDeck(v.deck, [...hole, ...board])
  const needBoard = 5 - board.length
  const need = opponents * holeCount + needBoard
  const full = new Array<Card>(5)
  const opp = Array.from({ length: opponents }, () => new Array<Card>(holeCount))
  let eq = 0
  for (let t = 0; t < trials; t++) {
    for (let i = 0; i < need; i++) {
      const j = i + Math.floor(rng() * (rest.length - i))
      const tmp = rest[i]
      rest[i] = rest[j]
      rest[j] = tmp
    }
    let k = 0
    for (const o of opp) for (let i = 0; i < holeCount; i++) o[i] = rest[k++]
    for (let i = 0; i < board.length; i++) full[i] = board[i]
    for (let i = board.length; i < 5; i++) full[i] = rest[k++]
    const mine = bestScore(hole, full, v.game, v.deck)
    let ties = 1
    let lost = false
    for (const o of opp) {
      const s = bestScore(o, full, v.game, v.deck)
      if (s > mine) {
        lost = true
        break
      }
      if (s === mine) ties++
    }
    if (!lost) eq += 1 / ties
  }
  return eq / trials
}

/** Qué tan seguido el bot se aparta de lo "correcto" para no ser previsible. */
export const BOT_STYLE = {
  /** Farol cuando nadie apostó y quedan 1 o 2 rivales. */
  bluff: 0.1,
  /** Con una mano muy buena, pasar o solo pagar en vez de apostar. */
  slowplay: 0.15,
  /** Margen sobre las pot odds para pagar (un poco más prudente que el mínimo). */
  callMargin: 0.02,
}

export interface Situation {
  legal: Legal
  /** Pozo total (lo que puso cada uno en la mano). */
  pot: number
  /** Rivales que siguen en la mano. */
  opponents: number
  equity: number
  chip: number
}

export interface BotDecision {
  action: Action
  equity: number
  /** Explicación corta, para mostrar o para los tests. */
  reason: string
}

/** Redondea a la ficha y lo deja entre lo mínimo y el all-in. */
function sizeTo(legal: Legal, target: number, chip: number): number {
  const rounded = Math.round(target / chip) * chip
  const to = Math.max(legal.minTo, Math.min(legal.maxTo, rounded))
  // Si queda casi todo, mejor all-in.
  return to >= legal.maxTo * 0.8 ? legal.maxTo : to
}

/** La decisión a partir de la equity ya calculada (separada para poder testearla). */
export function decide(s: Situation, rng: Rng): BotDecision {
  const { legal, pot, opponents, equity, chip } = s
  const fair = 1 / (opponents + 1) // lo que le tocaría "por partes iguales"
  const strength = equity / fair // 1 = normal; 2 = el doble de lo que le toca
  const pct = `${Math.round(equity * 100)}%`
  // Subida: la mínima más una parte del pozo (contando lo que paga).
  const raiseTo = (frac: number) => sizeTo(legal, legal.minTo + (pot + legal.toCall) * frac, chip)

  if (legal.canCheck) {
    // Nadie le apostó: pasar es gratis, así que nunca se retira.
    const strong = strength >= 1.5 && equity >= 0.35
    if (legal.canRaise && strong) {
      if (strength >= 2.5 && rng() < BOT_STYLE.slowplay) {
        return { action: { type: "check" }, equity, reason: `Juega lento: ${pct} de ganar` }
      }
      const frac = 0.5 + rng() * 0.3
      return { action: { type: "raise", to: sizeTo(legal, pot * frac, chip) }, equity, reason: `Apuesta: ${pct} de ganar` }
    }
    if (legal.canRaise && opponents <= 2 && rng() < BOT_STYLE.bluff) {
      return { action: { type: "raise", to: sizeTo(legal, pot * 0.5, chip) }, equity, reason: `Farol con ${pct}` }
    }
    return { action: { type: "check" }, equity, reason: `Pasa: ${pct} de ganar` }
  }

  // Le apostaron: ¿le alcanza para pagar?
  const needed = legal.toCall / (pot + legal.toCall)
  if (equity < needed + BOT_STYLE.callMargin) {
    return { action: { type: "fold" }, equity, reason: `Se retira: ${pct} y necesita ${Math.round(needed * 100)}%` }
  }
  // Muy por encima de lo que necesita: sube (o a veces solo paga para disimular).
  if (legal.canRaise && strength >= 1.8 && equity >= needed + 0.2 && rng() >= BOT_STYLE.slowplay) {
    return { action: { type: "raise", to: raiseTo(0.4 + rng() * 0.4) }, equity, reason: `Sube: ${pct} de ganar` }
  }
  return { action: { type: "call" }, equity, reason: `Paga: ${pct} y necesita ${Math.round(needed * 100)}%` }
}

/** Lo que hace el bot al que le toca hablar. */
export function botDecide(t: TableState, rng: Rng = Math.random, trials?: number): BotDecision {
  const h = t.hand
  const legal = legalActions(t)
  if (!h || !legal) throw new Error("No le toca hablar a nadie")
  const me = h.players.find((p) => p.seat === legal.seat)!
  const opponents = h.players.filter((p) => !p.folded && p.seat !== me.seat).length
  const equity = estimateEquity(me.hole, h.board, h.variant, opponents, trials ?? BOT_TRIALS[h.variant.game], rng)
  return decide({ legal, pot: potTotal(h), opponents, equity, chip: t.config.chip }, rng)
}

/** Juega por el bot que habla y devuelve la mesa nueva. */
export function botAct(t: TableState, rng: Rng = Math.random, trials?: number): { table: TableState; decision: BotDecision } {
  const decision = botDecide(t, rng, trials)
  return { table: act(t, decision.action), decision }
}

/** Los bots piden otra cajita solo cuando se quedan sin fichas. */
export function botWantsCajita(t: TableState, seat: number): boolean {
  return t.seats[seat].stack === 0 && canRequestCajita(t, seat)
}
