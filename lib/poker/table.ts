// Motor de una mano de poker con las reglas de La Cajita (ver
// docs/plan-jugar-contra-bots.md). Código puro: no sabe de pantallas, bots ni
// base de datos. Lo usa "Jugar contra bots" y lo usaría la mesa online.
//
// Reglas:
// - Luz igual para todos, sin ciegas: va al pozo pero no es una apuesta, así
//   que antes del flop, como en las otras calles, se puede pasar.
// - En todas las calles habla primero el de la izquierda del que reparte y el
//   que reparte habla último.
// - Sin límite. La apuesta mínima es la luz; la subida mínima, lo que subió el
//   último (si nadie subió en la calle, la luz). Un all-in que no llega a la
//   subida mínima no le reabre la subida a quien ya habló.
// - Pozos laterales: se arman al final con lo que puso cada uno en la mano.
// - Cajitas: se piden con una cuarta parte de la cajita o menos y entran antes
//   de la mano siguiente.
//
// El estado es un objeto plano (se puede guardar en localStorage); cada función
// devuelve uno nuevo sin tocar el anterior.

import { makeDeck, shuffle, type Card, type Rng } from "./cards"
import { bestHand } from "./evaluator"
import { GAMES, type Variant } from "./variants"

export type BettingStreet = "preflop" | "flop" | "turn" | "river"
const NEXT_STREET: Record<BettingStreet, BettingStreet | null> = {
  preflop: "flop",
  flop: "turn",
  turn: "river",
  river: null,
}
const BOARD_AFTER: Record<BettingStreet, number> = { preflop: 0, flop: 3, turn: 4, river: 5 }

export interface TableConfig {
  /** Valor de la cajita: lo que suma en fichas cada una. */
  cajita: number
  /** Luz por jugador. */
  luz: number
  /** Juegos de la mesa: uno (fijo) o varios (se rota una vuelta de cada uno). */
  variants: Variant[]
  /** Ficha más chica: las apuestas son múltiplos (salvo un all-in). */
  chip: number
  /** Quemar una carta antes del flop, del turn y del river. */
  burn: boolean
}

export const DEFAULT_CONFIG: TableConfig = {
  cajita: 2000,
  luz: 100,
  variants: [{ game: "holdem", deck: "long" }],
  chip: 100,
  burn: false,
}

export interface SeatState {
  id: string
  name: string
  /** Fichas delante (sin contar lo que ya puso en la mano en curso). */
  stack: number
  /** Cajitas pedidas en total. */
  cajitas: number
  /** Cajitas pedidas que entran antes de la mano siguiente. */
  pending: number
}

export interface HandPlayer {
  seat: number
  hole: Card[]
  folded: boolean
  allIn: boolean
  /** Lo que puso en toda la mano (luz incluida). */
  committed: number
  /** Lo que puso en la calle actual (sin la luz). */
  streetBet: number
  /** Ya habló en esta vuelta de apuestas. */
  acted: boolean
  /** Puede subir si le vuelve a tocar (false si ya habló y nadie subió completo después). */
  canRaise: boolean
}

export type Action =
  | { type: "fold" }
  | { type: "check" }
  | { type: "call" }
  /** Apostar o subir hasta `to` en total en la calle (para all-in: streetBet + stack). */
  | { type: "raise"; to: number }

export interface ActionLog {
  seat: number
  street: BettingStreet
  action: Action["type"] | "allIn"
  /** Lo que puso con esta acción. */
  amount: number
  /** Para apostar/subir: hasta cuánto quedó la apuesta de la calle. */
  to?: number
}

export interface PotResult {
  amount: number
  /** Asientos que podían ganarlo. */
  eligible: number[]
  winners: number[]
}

export interface HandResult {
  /** true: se vieron las cartas; false: se retiraron todos menos uno. */
  showdown: boolean
  pots: PotResult[]
  /** Cuánto cobró cada asiento (incluye lo suyo que le vuelve). */
  won: Record<number, number>
  /** Nombre de la mano de cada uno que llegó al final (solo si hubo showdown). */
  handNames: Record<number, string>
}

export interface HandState {
  number: number
  variant: Variant
  button: number
  players: HandPlayer[]
  board: Card[]
  /** Cartas que quedan en el mazo, en el orden en que salen. */
  deck: Card[]
  street: BettingStreet
  /** Apuesta más alta de la calle. */
  currentBet: number
  /** Tamaño de la última subida completa de la calle (la mínima para subir). */
  lastRaise: number
  /** Asiento que habla, o null si la mano terminó. */
  toAct: number | null
  log: ActionLog[]
  result: HandResult | null
}

export interface TableState {
  config: TableConfig
  seats: SeatState[]
  /** Manos jugadas (la próxima es la número handsPlayed + 1). */
  handsPlayed: number
  /** Quién repartió la última mano (-1 si todavía no hubo). */
  button: number
  hand: HandState | null
}

const clone = <T,>(x: T): T => structuredClone(x)

/** Máximo de jugadores para un juego: cartas propias de todos + 5 de la mesa (+3 quemadas). */
export function maxSeats(v: Variant, burn = false, cap = 8): number {
  const deck = v.deck === "short" ? 36 : 52
  return Math.min(cap, Math.floor((deck - 5 - (burn ? 3 : 0)) / GAMES[v.game].holeCount))
}

/** Mesa nueva: cada uno arranca con una cajita. */
export function createTable(config: TableConfig, players: { id: string; name: string }[]): TableState {
  if (players.length < 2) throw new Error("Hacen falta al menos 2 jugadores")
  for (const v of config.variants) {
    if (players.length > maxSeats(v, config.burn)) throw new Error(`No entran ${players.length} jugadores en ${GAMES[v.game].name} ${v.deck}`)
  }
  if (config.variants.length === 0) throw new Error("Falta el juego")
  // Todo en múltiplos de la ficha: así cualquier apuesta, pozo y all-in también lo es.
  if (config.luz <= 0 || config.luz % config.chip !== 0) throw new Error(`La luz va de a ${config.chip}`)
  if (config.cajita <= 0 || config.cajita % config.chip !== 0) throw new Error(`La cajita va de a ${config.chip}`)
  return {
    config: clone(config),
    seats: players.map((p) => ({ id: p.id, name: p.name, stack: config.cajita, cajitas: 1, pending: 0 })),
    handsPlayed: 0,
    button: -1,
    hand: null,
  }
}

/** Puede pedir otra cajita: le queda una cuarta parte de la cajita o menos (contando lo que tiene en juego). */
export function canRequestCajita(t: TableState, seat: number): boolean {
  const s = t.seats[seat]
  if (!s || s.pending > 0) return false
  const inPlay = t.hand && !t.hand.result ? (t.hand.players.find((p) => p.seat === seat)?.committed ?? 0) : 0
  return s.stack + inPlay <= t.config.cajita / 4
}

export function requestCajita(t: TableState, seat: number): TableState {
  if (!canRequestCajita(t, seat)) throw new Error("Todavía no podés pedir otra cajita")
  const out = clone(t)
  out.seats[seat].pending += 1
  return out
}

/** El juego de la mano número `n` (1, 2, …): en modo rotación cambia cada vuelta completa de la mesa. */
export function variantForHand(t: TableState, n: number): Variant {
  const vs = t.config.variants
  return vs[Math.floor((n - 1) / t.seats.length) % vs.length]
}

const nextSeat = (from: number, count: number) => (from + 1) % count

/**
 * Empieza la mano siguiente: entran las cajitas pedidas, rota el botón, se pone
 * la luz y se reparte. `fixed` es para tests: cartas propias por asiento y mesa.
 */
export function startHand(
  t: TableState,
  rng: Rng = Math.random,
  fixed?: { holes: Record<number, Card[]>; board: Card[] },
): TableState {
  if (t.hand && !t.hand.result) throw new Error("La mano anterior no terminó")
  const out = clone(t)
  for (const s of out.seats) {
    s.stack += s.pending * out.config.cajita
    s.cajitas += s.pending
    s.pending = 0
  }
  const live = out.seats.map((s, i) => (s.stack > 0 ? i : -1)).filter((i) => i >= 0)
  if (live.length < 2) throw new Error("Hacen falta al menos 2 jugadores con fichas")

  const n = out.handsPlayed + 1
  const variant = variantForHand(out, n)
  const holeCount = GAMES[variant.game].holeCount
  // Botón: el próximo con fichas después del anterior.
  let button = out.button
  do button = nextSeat(button, out.seats.length)
  while (out.seats[button].stack <= 0)

  // Orden de reparto y de habla: desde la izquierda del botón; el botón último.
  const order: number[] = []
  for (let i = 1; i <= out.seats.length; i++) {
    const s = (button + i) % out.seats.length
    if (out.seats[s].stack > 0) order.push(s)
  }

  let deck: Card[]
  let holes: Record<number, Card[]>
  if (fixed) {
    holes = fixed.holes
    const used = new Set([...Object.values(fixed.holes).flat(), ...fixed.board])
    // La mesa fija va primero en el mazo para que salga en ese orden.
    deck = [...fixed.board, ...makeDeck(variant.deck).filter((c) => !used.has(c))]
    if (out.config.burn) throw new Error("Con cartas fijas no se quema")
  } else {
    const shuffled = shuffle(makeDeck(variant.deck), rng)
    holes = {}
    for (const s of order) holes[s] = []
    for (let k = 0; k < holeCount; k++) for (const s of order) holes[s].push(shuffled.pop()!)
    deck = shuffled.reverse()
  }

  const players: HandPlayer[] = order.map((s) => {
    const seat = out.seats[s]
    const luz = Math.min(out.config.luz, seat.stack)
    seat.stack -= luz
    return {
      seat: s,
      hole: holes[s],
      folded: false,
      allIn: seat.stack === 0,
      committed: luz,
      streetBet: 0,
      acted: false,
      canRaise: true,
    }
  })

  out.button = button
  out.handsPlayed = n
  out.hand = {
    number: n,
    variant,
    button,
    players,
    board: [],
    deck,
    street: "preflop",
    currentBet: 0,
    lastRaise: out.config.luz,
    toAct: null,
    log: [],
    result: null,
  }
  out.hand.toAct = firstToAct(out.hand)
  if (out.hand.toAct === null) settle(out)
  return out
}

function player(h: HandState, seat: number): HandPlayer {
  const p = h.players.find((x) => x.seat === seat)
  if (!p) throw new Error(`El asiento ${seat} no está en la mano`)
  return p
}

/** Los que todavía pueden decidir algo (no se retiraron ni están all-in). */
const canAct = (p: HandPlayer) => !p.folded && !p.allIn

/** Primero en hablar en la calle: el primero de la lista (ya está desde la izquierda del botón). */
function firstToAct(h: HandState): number | null {
  const active = h.players.filter(canAct)
  if (active.length === 0) return null
  // Si queda uno solo con fichas y nadie le apostó, no hay nada que decidir.
  if (active.length === 1 && active[0].streetBet >= h.currentBet) return null
  return active[0].seat
}

/** Apuesta o subida mínima completa (total en la calle): la luz si nadie apostó; si no, apuesta + última subida. */
function fullMinTo(c: TableConfig, h: HandState): number {
  return h.currentBet === 0 ? Math.max(c.luz, c.chip) : h.currentBet + h.lastRaise
}

/** Lo que puede hacer el que habla. */
export interface Legal {
  seat: number
  canCheck: boolean
  /** Lo que le cuesta pagar (0 si puede pasar). Si es igual a su stack, pagar es all-in. */
  toCall: number
  canRaise: boolean
  /** Hasta cuánto mínimo puede apostar/subir (total en la calle). */
  minTo: number
  /** Hasta cuánto máximo (all-in). */
  maxTo: number
}

export function legalActions(t: TableState): Legal | null {
  const h = t.hand
  if (!h || h.toAct === null) return null
  const p = player(h, h.toAct)
  const stack = t.seats[p.seat].stack
  const toCall = Math.min(h.currentBet - p.streetBet, stack)
  const maxTo = p.streetBet + stack
  // Apuesta mínima: la luz; subida mínima: la última subida completa.
  const minTo = Math.min(maxTo, fullMinTo(t.config, h))
  // Subir: tiene que tener más de lo que cuesta pagar, y que alguien más pueda pagarle.
  const othersCanCall = h.players.some((o) => o.seat !== p.seat && canAct(o))
  const canRaise = p.canRaise && maxTo > h.currentBet && othersCanCall
  return { seat: p.seat, canCheck: p.streetBet >= h.currentBet, toCall, canRaise, minTo, maxTo }
}

/** Aplica la acción del que habla. Tira error si no es válida. */
export function act(t: TableState, action: Action): TableState {
  const legal = legalActions(t)
  if (!legal) throw new Error("No le toca hablar a nadie")
  const out = clone(t)
  const h = out.hand!
  const p = player(h, legal.seat)
  const seat = out.seats[p.seat]
  const put = (amount: number) => {
    seat.stack -= amount
    p.committed += amount
    p.streetBet += amount
    if (seat.stack === 0) p.allIn = true
  }

  switch (action.type) {
    case "fold":
      p.folded = true
      h.log.push({ seat: p.seat, street: h.street, action: "fold", amount: 0 })
      break
    case "check":
      if (!legal.canCheck) throw new Error("No podés pasar: hay una apuesta")
      h.log.push({ seat: p.seat, street: h.street, action: "check", amount: 0 })
      break
    case "call": {
      if (legal.toCall === 0) throw new Error("No hay nada que pagar: pasá")
      put(legal.toCall)
      h.log.push({ seat: p.seat, street: h.street, action: p.allIn ? "allIn" : "call", amount: legal.toCall })
      break
    }
    case "raise": {
      const to = action.to
      if (!legal.canRaise) throw new Error("No podés subir")
      if (to > legal.maxTo) throw new Error("No tenés tantas fichas")
      const allIn = to === legal.maxTo
      if (to < legal.minTo && !allIn) throw new Error(`Lo mínimo es ${legal.minTo}`)
      if (!allIn && to % out.config.chip !== 0) throw new Error(`Las apuestas van de a ${out.config.chip}`)
      if (to <= h.currentBet) throw new Error("Para subir hay que superar la apuesta")
      const raise = to - h.currentBet
      const added = to - p.streetBet
      // Completa: llega a la mínima sin el tope del stack (si nadie había apostado, la apuesta mínima).
      const full = to >= fullMinTo(out.config, h)
      put(added)
      if (full) {
        h.lastRaise = raise
        // Subida completa: todos los demás vuelven a hablar y pueden subir.
        for (const o of h.players) if (o !== p && canAct(o)) {
          o.acted = false
          o.canRaise = true
        }
      } else {
        // All-in corto: los demás tienen que contestar, pero no se les reabre la subida.
        for (const o of h.players) if (o !== p && canAct(o)) o.acted = false
      }
      h.currentBet = to
      h.log.push({ seat: p.seat, street: h.street, action: p.allIn ? "allIn" : "raise", amount: added, to })
      break
    }
  }
  p.acted = true
  p.canRaise = false

  advance(out)
  return out
}

/** Después de una acción: pasa el turno, cierra la calle o termina la mano. */
function advance(t: TableState) {
  const h = t.hand!
  const inHand = h.players.filter((p) => !p.folded)
  if (inHand.length === 1) {
    h.toAct = null
    settle(t)
    return
  }
  const next = nextToAct(h)
  if (next !== null) {
    h.toAct = next
    return
  }
  // Se cerró la vuelta de apuestas.
  closeStreet(t)
}

/** El próximo que tiene que hablar después del que habló, o null si la vuelta se cerró. */
function nextToAct(h: HandState): number | null {
  const idx = h.players.findIndex((p) => p.seat === h.toAct)
  for (let i = 1; i <= h.players.length; i++) {
    const p = h.players[(idx + i) % h.players.length]
    if (!canAct(p)) continue
    if (!p.acted || p.streetBet < h.currentBet) return p.seat
  }
  return null
}

function deal(h: HandState, count: number, burn: boolean) {
  if (burn) h.deck.shift()
  for (let i = 0; i < count; i++) h.board.push(h.deck.shift()!)
}

function closeStreet(t: TableState) {
  const h = t.hand!
  for (;;) {
    const next = NEXT_STREET[h.street]
    if (!next) {
      h.toAct = null
      settle(t)
      return
    }
    h.street = next
    deal(h, BOARD_AFTER[next] - h.board.length, t.config.burn)
    h.currentBet = 0
    h.lastRaise = t.config.luz
    for (const p of h.players) {
      p.streetBet = 0
      p.acted = false
      p.canRaise = true
    }
    const first = firstToAct(h)
    if (first !== null) {
      h.toAct = first
      return
    }
    // Nadie puede apostar (todos all-in, o uno solo con fichas): salen las cartas que faltan.
  }
}

/** Arma los pozos (principal y laterales) con lo que puso cada uno. */
export function buildPots(players: readonly HandPlayer[]): { amount: number; eligible: number[] }[] {
  const levels = [...new Set(players.map((p) => p.committed).filter((c) => c > 0))].sort((a, b) => a - b)
  const pots: { amount: number; eligible: number[] }[] = []
  let prev = 0
  for (const level of levels) {
    const amount = players.reduce((sum, p) => sum + Math.max(0, Math.min(p.committed, level) - prev), 0)
    const eligible = players.filter((p) => !p.folded && p.committed >= level).map((p) => p.seat)
    if (amount > 0) {
      // Un nivel sin nadie que lo pueda ganar se suma al pozo anterior.
      if (eligible.length === 0 && pots.length > 0) pots[pots.length - 1].amount += amount
      else pots.push({ amount, eligible })
    }
    prev = level
  }
  // Pozos seguidos con los mismos candidatos son uno solo.
  const merged: typeof pots = []
  for (const pot of pots) {
    const last = merged[merged.length - 1]
    if (last && last.eligible.join() === pot.eligible.join()) last.amount += pot.amount
    else merged.push(pot)
  }
  return merged
}

/** Reparte los pozos y termina la mano. */
function settle(t: TableState) {
  const h = t.hand!
  const inHand = h.players.filter((p) => !p.folded)
  const won: Record<number, number> = {}
  const handNames: Record<number, string> = {}
  const pots = buildPots(h.players)
  const results: PotResult[] = []

  if (inHand.length === 1) {
    const total = pots.reduce((s, p) => s + p.amount, 0)
    won[inHand[0].seat] = total
    results.push({ amount: total, eligible: [inHand[0].seat], winners: [inHand[0].seat] })
  } else {
    // Si se cerró antes del river (todos all-in), salen las que faltan.
    if (h.board.length < 5) deal(h, 5 - h.board.length, false)
    const scores: Record<number, number> = {}
    for (const p of inHand) {
      const best = bestHand(p.hole, h.board, h.variant.game, h.variant.deck)!
      scores[p.seat] = best.score
      handNames[p.seat] = best.name
    }
    for (const pot of pots) {
      const top = Math.max(...pot.eligible.map((s) => scores[s]))
      const winners = pot.eligible.filter((s) => scores[s] === top)
      // Empate: se reparte de a fichas; lo que no se divide va al primero desde la izquierda del botón.
      const chip = t.config.chip
      const share = Math.floor(pot.amount / winners.length / chip) * chip
      let rest = pot.amount - share * winners.length
      const ordered = h.players.map((p) => p.seat).filter((s) => winners.includes(s))
      for (const s of ordered) {
        const extra = Math.min(rest, chip)
        won[s] = (won[s] ?? 0) + share + extra
        rest -= extra
      }
      if (rest > 0) won[ordered[0]] += rest
      results.push({ amount: pot.amount, eligible: pot.eligible, winners })
    }
  }
  for (const [s, amount] of Object.entries(won)) t.seats[Number(s)].stack += amount
  h.toAct = null
  h.result = { showdown: inHand.length > 1, pots: results, won, handNames }
}

/** Fichas de cada uno en la mesa ahora (stack + lo que ya puso en la mano en curso). */
export function chipsOf(t: TableState, seat: number): number {
  const inPlay = t.hand && !t.hand.result ? (t.hand.players.find((p) => p.seat === seat)?.committed ?? 0) : 0
  return t.seats[seat].stack + inPlay
}

/** Pozo total de la mano en curso. */
export const potTotal = (h: HandState) => h.players.reduce((s, p) => s + p.committed, 0)

/** Cómo terminó cada uno: fichas − cajitas × valor. */
export function netResult(t: TableState, seat: number): number {
  const s = t.seats[seat]
  return chipsOf(t, seat) - s.cajitas * t.config.cajita
}
