// Generadores de ejercicios. Funciones puras (con rng inyectable) para poder
// testearlas; la UI solo las muestra.

import { makeCard, type Card, type Rng } from "./cards"
import { POSITIONS_BY_TABLE, gridClasses, handClass, openRange, type HandClass, type Position } from "./preflop"
import { betaThreshold, equityVsRandom, shortOpens } from "./preflop-beta"
import { bestHand, bestScore, Cat, categoryOf, categoryOrder, combos, eval5, handName, type BestHand } from "./evaluator"
import { countOuts, deal, equityExact, equityMonteCarlo } from "./equity"
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

// ── ¿Abrís? (rangos de apertura, Hold'em Long) ─────────────────────────────

export interface PreflopDrill {
  kind: "preflop"
  /** Jugadores en la mesa. */
  table: 4 | 5 | 6
  pos: Position
  cards: Card[]
  /** Clase de la mano (solo Hold'em: "AKs", "77"…). */
  hand: HandClass | null
  /** Lo correcto: abrir (subir) o tirar. */
  open: boolean
  /** Beta: inferido (todo menos Hold'em largo). */
  beta: boolean
  /** Omaha/Manhattan beta: equity de la mano contra 2 al azar y la mínima para abrir. */
  equity?: number
  threshold?: number
}

const BETA_TRIALS: Record<Variant["game"], number> = { holdem: 0, omaha: 1500, manhattan: 800 }
/** Omaha/Manhattan: descartar manos tan cerca del umbral que la simulación no alcanza para decidir. */
const BETA_MARGIN = 0.025

function holdemCards(deck: "long" | "short", rng: Rng): Card[] {
  // Mitad de las veces reparto al azar y mitad una casilla de la grilla al
  // azar (así aparecen más manos de borde y no todo es "tirar").
  if (rng() < 0.5) return deal({ game: "holdem", deck }, 1, 2, 0, rng).holes[0]
  const grid = gridClasses(deck).flat()
  const cls = grid[Math.floor(rng() * grid.length)]
  const hi = "23456789TJQKA".indexOf(cls[0]) + 2
  const lo = "23456789TJQKA".indexOf(cls[1]) + 2
  const s1 = Math.floor(rng() * 4)
  let s2 = cls.endsWith("s") ? s1 : Math.floor(rng() * 3)
  if (!cls.endsWith("s") && s2 >= s1) s2++
  return [makeCard(hi, s1), makeCard(lo, s2)]
}

/** Te toca hablar y todos los anteriores tiraron: ¿abrís? */
export function makePreflop(v: Variant, rng: Rng = Math.random, table?: 4 | 5 | 6): PreflopDrill {
  const t = table ?? ([4, 5, 6] as const)[Math.floor(rng() * 3)]
  const positions = POSITIONS_BY_TABLE[t]
  const pos = positions[Math.floor(rng() * positions.length)]
  const base = { kind: "preflop" as const, table: t, pos }

  if (v.game === "holdem") {
    const cards = holdemCards(v.deck, rng)
    const hand = handClass(cards[0], cards[1])
    const open = v.deck === "long" ? openRange(pos).has(hand) : shortOpens(hand, pos)
    return { ...base, cards, hand, open, beta: v.deck === "short" }
  }

  const threshold = betaThreshold(v, pos)
  let fallback: PreflopDrill | null = null
  for (let tries = 0; tries < 30; tries++) {
    const cards = deal(v, 1, GAMES[v.game].holeCount, 0, rng).holes[0]
    const equity = equityVsRandom(cards, v, BETA_TRIALS[v.game], rng)
    const d: PreflopDrill = { ...base, cards, hand: null, open: equity >= threshold, beta: true, equity, threshold }
    if (Math.abs(equity - threshold) >= BETA_MARGIN) return d
    fallback ??= d
  }
  return fallback!
}

// ── ¿Cuál es mejor? (dos manos antes del flop, mano a mano) ────────────────

export interface CompareDrill {
  kind: "compare"
  hands: [Card[], Card[]]
  /** Parte del pozo de cada una mano a mano (empates a medias). */
  equity: [number, number]
  /** La que gana más seguido. */
  better: 0 | 1
  /** Mesas simuladas. */
  samples: number
}

const COMPARE_TRIALS: Record<Variant["game"], number> = { holdem: 6000, omaha: 3000, manhattan: 1500 }
/** Diferencia mínima entre las dos (en equity) para que la respuesta sea clara. */
export const COMPARE_MIN_GAP = 0.08

export function makeCompare(v: Variant, rng: Rng = Math.random): CompareDrill {
  const holeCount = GAMES[v.game].holeCount
  let best: CompareDrill | null = null
  for (let tries = 0; tries < 40; tries++) {
    const { holes } = deal(v, 2, holeCount, 0, rng)
    // Filtro rápido para no gastar simulaciones en manos parejas.
    const quick = equityMonteCarlo(holes, [], v, 300, rng)
    if (Math.abs(quick.equity[0] - quick.equity[1]) < COMPARE_MIN_GAP) continue
    const trials = COMPARE_TRIALS[v.game]
    const r = equityMonteCarlo(holes, [], v, trials, rng)
    const d: CompareDrill = {
      kind: "compare",
      hands: [holes[0], holes[1]],
      equity: [r.equity[0], r.equity[1]],
      better: r.equity[0] >= r.equity[1] ? 0 : 1,
      samples: trials,
    }
    if (Math.abs(r.equity[0] - r.equity[1]) >= COMPARE_MIN_GAP) return d
    if (!best || Math.abs(r.equity[0] - r.equity[1]) > Math.abs(best.equity[0] - best.equity[1])) best = d
  }
  return best!
}

/** Rasgos de una mano para explicar por qué es mejor o peor (solo hechos, sin juicio). */
export function handTraits(cards: readonly Card[]): string[] {
  const out: string[] = []
  const bySuit = [0, 0, 0, 0]
  for (const c of cards) bySuit[c & 3]++
  const suited = bySuit.filter((n) => n >= 2)
  if (cards.length === 2) out.push(suited.length ? "mismo palo" : "distinto palo")
  else if (bySuit.some((n) => n === cards.length)) out.push("todas del mismo palo")
  else if (suited.length >= 2) out.push("dos palos")
  else if (suited.length === 1) out.push(suited[0] >= 3 ? `${suited[0]} del mismo palo` : "un palo")
  else out.push("sin palo repetido")

  const byRank = new Map<number, number>()
  for (const c of cards) byRank.set((c >> 2) + 2, (byRank.get((c >> 2) + 2) ?? 0) + 1)
  const name = (r: number) => ({ 11: "J", 12: "Q", 13: "K", 14: "A" })[r] ?? String(r)
  for (const [r, n] of [...byRank].sort((a, b) => b[0] - a[0])) {
    if (n === 2) out.push(`par de ${name(r)}`)
    if (n === 3) out.push(`trío de ${name(r)}`)
    if (n === 4) out.push(`cuatro ${name(r)}`)
  }
  // Escalerita más larga de rangos distintos (el As también cuenta abajo).
  const ranks = new Set(byRank.keys())
  if (ranks.has(14)) ranks.add(1)
  let run = 0
  let longest = 0
  for (let r = 1; r <= 14; r++) {
    run = ranks.has(r) ? run + 1 : 0
    longest = Math.max(longest, run)
  }
  if (longest >= 2) out.push(longest === 2 ? "2 seguidas" : `${longest} seguidas`)
  const high = cards.filter((c) => (c >> 2) + 2 >= 10).length
  out.push(high === 0 ? "ninguna alta (10 o más)" : high === 1 ? "1 carta alta" : `${high} cartas altas`)
  return out
}

// ── Con luz (como se juega en La Cajita) ───────────────────────────────────
// Sin ciegas: todos ponen la misma luz, habla primero el de la izquierda del
// que reparte y el que reparte habla último. Si nadie apostó, se puede pasar.

export interface LuzDrill {
  kind: "luz"
  players: number
  /** Orden en que hablás (1 = primero; `players` = el que reparte). */
  seat: number
  luz: number
  /** Pozo antes de la apuesta: la luz de todos. */
  pot: number
  hero: Card[]
  /** null: nadie apostó antes que vos. */
  bet: null | {
    seat: number
    amount: number
    villain: Card[]
    /** Tu parte del pozo mano a mano contra su mano (empates a medias). */
    equity: number
    /** Lo mínimo que necesitás ganar para que pagar convenga. */
    needed: number
    shouldCall: boolean
    close: boolean
    samples: number
  }
}

const LUZ_VALUES = [50, 100, 200]
const LUZ_BET_FRACTIONS = [1 / 2, 2 / 3, 1, 3 / 2, 2]
const LUZ_TRIALS: Record<Variant["game"], number> = { holdem: 5000, omaha: 2500, manhattan: 1200 }

export function makeLuz(v: Variant, rng: Rng = Math.random): LuzDrill {
  const players = 4 + Math.floor(rng() * 3)
  const luz = LUZ_VALUES[Math.floor(rng() * LUZ_VALUES.length)]
  const pot = players * luz
  const holeCount = GAMES[v.game].holeCount

  // 1 de cada 5: nadie apostó (la lección es no tirar gratis).
  if (rng() < 0.2) {
    const seat = 1 + Math.floor(rng() * players)
    const hero = deal(v, 1, holeCount, 0, rng).holes[0]
    return { kind: "luz", players, seat, luz, pot, hero, bet: null }
  }

  const seat = 2 + Math.floor(rng() * (players - 1))
  const betSeat = 1 + Math.floor(rng() * (seat - 1))
  const { holes } = deal(v, 2, holeCount, 0, rng)
  const frac = LUZ_BET_FRACTIONS[Math.floor(rng() * LUZ_BET_FRACTIONS.length)]
  const amount = Math.max(luz, Math.round((pot * frac) / 50) * 50)
  const trials = LUZ_TRIALS[v.game]
  const equity = equityMonteCarlo(holes, [], v, trials, rng).equity[0]
  const needed = amount / (pot + 2 * amount)
  return {
    kind: "luz",
    players,
    seat,
    luz,
    pot,
    hero: holes[0],
    bet: {
      seat: betSeat,
      amount,
      villain: holes[1],
      equity,
      needed,
      shouldCall: equity >= needed,
      // Margen por la simulación: si están a menos de 3 puntos, las dos valen.
      close: Math.abs(equity - needed) < 0.03,
      samples: trials,
    },
  }
}
