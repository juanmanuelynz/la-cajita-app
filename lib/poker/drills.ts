// Generadores de ejercicios. Funciones puras (con rng inyectable) para poder
// testearlas; la UI solo las muestra.

import type { Card, Rng } from "./cards"
import { bestHand, bestScore, Cat, categoryOf, categoryOrder, combos, eval5, handName, type BestHand } from "./evaluator"
import { countOuts, deal, equityExact } from "./equity"
import { BOARD_BY_STREET, GAMES, type Street, type Variant } from "./variants"

// ── ¿Qué mano gana? ────────────────────────────────────────────────────────

export interface WhoWinsDrill {
  kind: "whoWins"
  holes: Card[][]
  board: Card[]
  hands: BestHand[]
  /** Índices de los ganadores (más de uno = reparten). */
  winners: number[]
}

export function makeWhoWins(v: Variant, rng: Rng = Math.random): WhoWinsDrill {
  // Hold'em con 3 manos para que haya más para leer; Omaha y Manhattan ya
  // tienen bastante con 2.
  const players = v.game === "holdem" ? 3 : 2
  const { holes, board } = deal(v, players, GAMES[v.game].holeCount, 5, rng)
  const hands = holes.map((h) => bestHand(h, board, v.game, v.deck)!)
  const top = Math.max(...hands.map((h) => h.score))
  const winners = hands.flatMap((h, i) => (h.score === top ? [i] : []))
  return { kind: "whoWins", holes, board, hands, winners }
}

// ── Contá los outs ─────────────────────────────────────────────────────────

export interface OutsDrill {
  kind: "outs"
  street: Exclude<Street, "river">
  hero: Card[]
  villain: Card[]
  board: Card[]
  heroHand: BestHand
  villainHand: BestHand
  outs: Card[]
  ties: Card[]
  unseen: number
  /** Opciones para elegir (incluye la correcta), ordenadas. */
  options: number[]
  /** Probabilidad exacta de ligar un out en la próxima carta. */
  nextCardPct: number
  /** Solo en el flop: equity exacta hasta el river (contando empates a medias). */
  riverEquity?: number
}

const MAX_OUTS: Record<Variant["game"], number> = { holdem: 21, omaha: 26, manhattan: 28 }

/** Una mano que va perdiendo en el flop o el turn pero tiene outs. */
function makeBehindSpot(v: Variant, street: "flop" | "turn", rng: Rng) {
  const holeCount = GAMES[v.game].holeCount
  for (let tries = 0; tries < 500; tries++) {
    const { holes, board } = deal(v, 2, holeCount, BOARD_BY_STREET[street], rng)
    const [hero, villain] = holes
    if (bestScore(hero, board, v.game, v.deck) >= bestScore(villain, board, v.game, v.deck)) continue
    const o = countOuts(hero, villain, board, v)
    if (o.outs.length < 1 || o.outs.length > MAX_OUTS[v.game]) continue
    return { hero, villain, board, ...o }
  }
  throw new Error("No se pudo generar la situación")
}

function outsOptions(correct: number, rng: Rng): number[] {
  const opts = new Set([correct])
  const deltas = [-4, -3, -2, -1, 1, 2, 3, 4, 6]
  while (opts.size < 4) {
    const d = deltas[Math.floor(rng() * deltas.length)]
    const x = correct + d
    if (x >= 0) opts.add(x)
  }
  return [...opts].sort((a, b) => a - b)
}

export function makeOuts(v: Variant, rng: Rng = Math.random): OutsDrill {
  const street = rng() < 0.5 ? "flop" : "turn"
  const s = makeBehindSpot(v, street, rng)
  const drill: OutsDrill = {
    kind: "outs",
    street,
    hero: s.hero,
    villain: s.villain,
    board: s.board,
    heroHand: bestHand(s.hero, s.board, v.game, v.deck)!,
    villainHand: bestHand(s.villain, s.board, v.game, v.deck)!,
    outs: s.outs,
    ties: s.ties,
    unseen: s.unseen,
    options: outsOptions(s.outs.length, rng),
    nextCardPct: s.outs.length / s.unseen,
  }
  if (street === "flop") drill.riverEquity = equityExact([s.hero, s.villain], s.board, v).equity[0]
  return drill
}

// ── ¿Pagás o te vas? (pot odds) ────────────────────────────────────────────

export interface PotOddsDrill {
  kind: "potOdds"
  /** Turn: falta una carta. Flop: te ponen all-in y faltan dos. */
  street: "flop" | "turn"
  hero: Card[]
  villain: Card[]
  board: Card[]
  heroHand: BestHand
  villainHand: BestHand
  outs: Card[]
  ties: Card[]
  unseen: number
  /** Pozo antes de la apuesta del rival. */
  pot: number
  bet: number
  /** Equity que necesitás para que pagar convenga: bet / (pot + 2·bet). */
  needed: number
  /** Tu equity real (empates cuentan la mitad). */
  equity: number
  /** Lo correcto: pagar si equity ≥ needed. */
  shouldCall: boolean
  /** Diferencia menor a 2 puntos: cualquiera de las dos vale. */
  close: boolean
}

const BET_FRACTIONS = [1 / 3, 1 / 2, 2 / 3, 3 / 4, 1, 1.5]

export function makePotOdds(v: Variant, rng: Rng = Math.random): PotOddsDrill {
  const street = rng() < 0.7 ? "turn" : "flop"
  const s = makeBehindSpot(v, street, rng)
  const equity =
    street === "turn"
      ? (s.outs.length + s.ties.length / 2) / s.unseen
      : equityExact([s.hero, s.villain], s.board, v).equity[0]

  // Montos en pesos parecidos a una mesa con cajitas de $2000.
  const pot = (4 + Math.floor(rng() * 57)) * 100 // $400 … $6000
  const frac = BET_FRACTIONS[Math.floor(rng() * BET_FRACTIONS.length)]
  const bet = Math.max(100, Math.round((pot * frac) / 50) * 50)
  const needed = bet / (pot + 2 * bet)

  return {
    kind: "potOdds",
    street,
    hero: s.hero,
    villain: s.villain,
    board: s.board,
    heroHand: bestHand(s.hero, s.board, v.game, v.deck)!,
    villainHand: bestHand(s.villain, s.board, v.game, v.deck)!,
    outs: s.outs,
    ties: s.ties,
    unseen: s.unseen,
    pot,
    bet,
    needed,
    equity,
    shouldCall: equity >= needed,
    close: Math.abs(equity - needed) < 0.02,
  }
}

// ── ¿Qué tenés? (qué cartas podés usar) ───────────────────────────────────

/** Mejor mano usando cualquier combinación de 5 cartas (como si fuera Hold'em sin límite). */
export function bestAnyFive(cards: readonly Card[], deck: Variant["deck"]): BestHand {
  let best: BestHand | null = null
  for (const c of combos(cards.length, 5)) {
    const five = c.map((i) => cards[i])
    const s = eval5(five[0], five[1], five[2], five[3], five[4], deck)
    if (!best || s > best.score) best = { score: s, cat: categoryOf(s, deck), cards: five, fromHole: [], name: handName(s, deck) }
  }
  return best!
}

export interface UsableDrill {
  kind: "usable"
  hole: Card[]
  board: Card[]
  /** La mejor mano válida según las reglas del juego. */
  hand: BestHand
  /** La que "parece" si usaras cualquier carta (la trampa). Solo si es mejor que la válida. */
  trap: BestHand | null
  /** Categorías para elegir, de la más alta a la más baja. */
  options: Cat[]
}

export function makeUsable(v: Variant, rng: Rng = Math.random): UsableDrill {
  const holeCount = GAMES[v.game].holeCount
  // En Omaha y Manhattan, casi siempre buscamos una mano con trampa: es
  // donde se equivoca el que recién empieza.
  const wantTrap = v.game !== "holdem" && rng() < 0.75
  const order = categoryOrder(v.deck)
  for (let tries = 0; ; tries++) {
    const { holes, board } = deal(v, 1, holeCount, 5, rng)
    const hole = holes[0]
    const hand = bestHand(hole, board, v.game, v.deck)!
    const any = bestAnyFive([...hole, ...board], v.deck)
    const trap = any.cat !== hand.cat && any.score > hand.score ? any : null
    if (wantTrap && !trap && tries < 400) continue
    // Sin trampa: que al menos haya algo para leer (par o más).
    if (!trap && hand.cat === Cat.HighCard && tries < 400) continue

    const opts = new Set<Cat>([hand.cat])
    if (trap) opts.add(trap.cat)
    // Completar con categorías vecinas a la correcta.
    const idx = order.indexOf(hand.cat)
    for (const d of [-1, 1, -2, 2, -3, 3, -4, 4]) {
      if (opts.size >= 4) break
      const c = order[idx + d]
      if (c !== undefined && rng() < 0.85) opts.add(c)
    }
    for (const c of order) if (opts.size < 4) opts.add(c)
    return { kind: "usable", hole, board, hand, trap, options: order.filter((c) => opts.has(c)) }
  }
}
