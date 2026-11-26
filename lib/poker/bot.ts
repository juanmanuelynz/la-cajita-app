// Bots de "Jugar contra bots" (ver docs/plan-jugar-contra-bots.md).
//
// En general deciden como el ejercicio "Con luz": simulan su chance de ganar
// (equity) contra los que siguen en la mano, con cartas al azar (no ven las de
// nadie), y la comparan con lo que tienen que pagar (pot odds). Es una regla
// nuestra, sin fuente: en la pantalla van con la etiqueta Beta.
//
// Excepción: con ciegas, en Hold'em Long y de 4 a 6 jugadores, antes del flop
// siguen los rangos de PokerStrategy que ya usa Entrenar (preflop.ts y
// preflop-vs.ts): abrir si nadie entró, y con 6, pagar o resubir contra una
// subida y contestar a una resubida. Con 4 o 5 se sacan las primeras
// posiciones, como en Entrenar (adaptación nuestra). Los tamaños de las
// subidas fuera de la apertura (3× la subida, 2,5× la resubida) son nuestros.
//
// Para que no sean 100% previsibles: a veces bluffean, a veces juegan lento una
// mano muy buena y el tamaño de la apuesta varía un poco.

import { remainingDeck, type Card, type Rng } from "./cards"
import { bestScore } from "./evaluator"
import { act, canRequestCajita, legalActions, potTotal, type Action, type HandState, type Legal, type TableState } from "./table"
import { handClass, OPEN_RANGES, openRange, type Position } from "./preflop"
import { vsAction, vsSpots, type Seat6 } from "./preflop-vs"
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
  /** Bluff cuando nadie apostó y quedan 1 o 2 rivales. */
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
  /** Equity simulada (NaN si decidió por rango). */
  equity: number
  /** De dónde sale la decisión: rangos de PokerStrategy o nuestra cuenta (Beta). */
  source: "pokerstrategy" | "equity"
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
        return { action: { type: "check" }, equity, source: "equity", reason: `Juega lento: ${pct} de ganar` }
      }
      const frac = 0.5 + rng() * 0.3
      return { action: { type: "raise", to: sizeTo(legal, pot * frac, chip) }, equity, source: "equity", reason: `Apuesta: ${pct} de ganar` }
    }
    if (legal.canRaise && opponents <= 2 && rng() < BOT_STYLE.bluff) {
      return { action: { type: "raise", to: sizeTo(legal, pot * 0.5, chip) }, equity, source: "equity", reason: `Bluff con ${pct}` }
    }
    return { action: { type: "check" }, equity, source: "equity", reason: `Pasa: ${pct} de ganar` }
  }

  // Le apostaron: ¿le alcanza para pagar?
  const needed = legal.toCall / (pot + legal.toCall)
  if (equity < needed + BOT_STYLE.callMargin) {
    return { action: { type: "fold" }, equity, source: "equity", reason: `Se retira: ${pct} y necesita ${Math.round(needed * 100)}%` }
  }
  // Muy por encima de lo que necesita: sube (o a veces solo paga para disimular).
  if (legal.canRaise && strength >= 1.8 && equity >= needed + 0.2 && rng() >= BOT_STYLE.slowplay) {
    return { action: { type: "raise", to: raiseTo(0.4 + rng() * 0.4) }, equity, source: "equity", reason: `Sube: ${pct} de ganar` }
  }
  return { action: { type: "call" }, equity, source: "equity", reason: `Paga: ${pct} y necesita ${Math.round(needed * 100)}%` }
}

/**
 * Posición de cada asiento antes del flop con ciegas, de 4 a 6 jugadores (como
 * en Entrenar: con menos de 6 se sacan las primeras). null si no aplica.
 * `players` arranca a la izquierda del botón: chica, grande, …, botón.
 */
export function seatPositions(h: HandState): Map<number, Seat6> | null {
  const n = h.players.length
  if (n < 4 || n > 6) return null
  const rest: Seat6[] = n === 6 ? ["UTG", "MP", "CO", "BU"] : n === 5 ? ["MP", "CO", "BU"] : ["CO", "BU"]
  const names: Seat6[] = ["SB", "BB", ...rest]
  return new Map(h.players.map((p, i) => [p.seat, names[i]]))
}

/** Antes del flop con ciegas en Hold'em Long: lo que dicen los rangos de PokerStrategy, o null si no hay rango para la situación. */
export function rangeDecision(t: TableState, legal: Legal): BotDecision | null {
  const h = t.hand!
  const c = t.config
  if (c.structure !== "ciegas" || h.street !== "preflop" || h.variant.game !== "holdem" || h.variant.deck !== "long") return null
  const pos = seatPositions(h)
  if (!pos) return null
  const me = h.players.find((p) => p.seat === legal.seat)!
  const mine = pos.get(me.seat)!
  const big = c.blinds.big
  const log = h.log.filter((x) => x.street === "preflop")
  // Subidas: tienen `to`. Pagos: call o all-in sin `to`.
  const raises = log.filter((x) => x.to !== undefined)
  const callsBefore = (i: number) => log.slice(0, i < 0 ? log.length : i).filter((x) => x.to === undefined && x.action !== "fold" && x.action !== "check")
  const myActs = log.filter((x) => x.seat === me.seat)
  const out = (type: "fold" | "call" | "raise", to: number, reason: string): BotDecision => {
    let action: Action
    if (type === "raise" && legal.canRaise) action = { type: "raise", to: sizeTo(legal, to, c.chip) }
    else if (type === "fold") action = legal.canCheck ? { type: "check" } : { type: "fold" }
    else action = legal.toCall === 0 ? { type: "check" } : { type: "call" }
    return { action, equity: NaN, source: "pokerstrategy", reason }
  }
  const cls = handClass(me.hole[0], me.hole[1])

  // Nadie entró antes: abrir o no (la grande no abre: ya puso).
  if (raises.length === 0 && callsBefore(-1).length === 0 && mine !== "BB") {
    const p = mine as Position
    if (!openRange(p).has(cls)) return out("fold", 0, `PokerStrategy: ${cls} no abre desde ${mine}`)
    const size = Number(OPEN_RANGES[p].openSize.replace(",", "."))
    return out("raise", size * big, `PokerStrategy: abre ${cls} desde ${mine}`)
  }
  // Las situaciones contra una subida son solo de mesas de 6.
  if (h.players.length !== 6) return null
  // Una subida, nadie pagó en el medio y todavía no hablé: pagar, resubir o fold.
  if (raises.length === 1 && myActs.length === 0) {
    const r = raises[0]
    const idx = log.indexOf(r)
    if (callsBefore(idx).length > 0 || log.slice(idx + 1).some((x) => x.action !== "fold")) return null
    const spot = vsSpots().find((s) => s.kind === "vsOpen" && s.hero === mine && s.villain === pos.get(r.seat))
    if (!spot) return null
    const a = vsAction(spot, me.hole)
    return out(a, 3 * r.to!, `PokerStrategy: contra la subida de ${spot.villain}, ${a === "raise" ? "resube" : a === "call" ? "paga" : "se va"} con ${cls}`)
  }
  // Abrí, me resubieron y nadie más entró: contestar a la resubida.
  if (raises.length === 2 && raises[0].seat === me.seat && myActs.length === 1) {
    const r = raises[1]
    const idx = log.indexOf(r)
    if (log.slice(log.indexOf(raises[0]) + 1).some((x) => x !== r && x.action !== "fold")) return null
    const spot = vsSpots().find((s) => s.kind === "vs3bet" && s.hero === mine && s.villain === pos.get(r.seat))
    if (!spot || idx < 0) return null
    const a = vsAction(spot, me.hole)
    return out(a, 2.5 * r.to!, `PokerStrategy: contra la resubida de ${spot.villain}, ${a === "raise" ? "vuelve a subir" : a === "call" ? "paga" : "se va"} con ${cls}`)
  }
  return null
}

/** Lo que hace el bot al que le toca hablar. */
export function botDecide(t: TableState, rng: Rng = Math.random, trials?: number): BotDecision {
  const h = t.hand
  const legal = legalActions(t)
  if (!h || !legal) throw new Error("No le toca hablar a nadie")
  const byRange = rangeDecision(t, legal)
  if (byRange) return byRange
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
