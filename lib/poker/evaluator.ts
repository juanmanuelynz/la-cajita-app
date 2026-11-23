// Evaluador de manos de 5 cartas y "mejor mano" según el juego.
//
// Un puntaje es un entero: más alto gana. Se arma como
//   fuerza_de_categoría << 20 | k1 << 16 | k2 << 12 | k3 << 8 | k4 << 4 | k5
// donde k1..k5 son los rangos que desempatan, en orden de importancia.
//
// Mazo corto (reglas de la casa): el color le gana al full, y la escalera le
// gana al trío como en el mazo largo. La escalera más baja es A-6-7-8-9.

import { rankOf, suitOf, type Card, type DeckType } from "./cards"
import { GAMES, type GameId } from "./variants"

export enum Cat {
  HighCard = 0,
  Pair = 1,
  TwoPair = 2,
  Trips = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  Quads = 7,
  StraightFlush = 8,
}

/** Fuerza de cada categoría (índice = Cat). En mazo corto el color sube sobre el full. */
const STRENGTH: Record<DeckType, readonly number[]> = {
  long: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  short: [0, 1, 2, 3, 4, 6, 5, 7, 8],
}

/** Categorías de la más alta a la más baja, para cada mazo. */
export function categoryOrder(deck: DeckType): Cat[] {
  const s = STRENGTH[deck]
  return ([0, 1, 2, 3, 4, 5, 6, 7, 8] as Cat[]).sort((a, b) => s[b] - s[a])
}

export const CATEGORY_NAMES: Record<Cat, string> = {
  [Cat.HighCard]: "Carta alta",
  [Cat.Pair]: "Par",
  [Cat.TwoPair]: "Doble par",
  [Cat.Trips]: "Trío",
  [Cat.Straight]: "Escalera",
  [Cat.Flush]: "Color",
  [Cat.FullHouse]: "Full",
  [Cat.Quads]: "Póker",
  [Cat.StraightFlush]: "Escalera de color",
}

// Bits de rango (bit r para el rango r) de la escalera más baja de cada mazo.
const WHEEL: Record<DeckType, number> = {
  long: (1 << 14) | (1 << 2) | (1 << 3) | (1 << 4) | (1 << 5),
  short: (1 << 14) | (1 << 6) | (1 << 7) | (1 << 8) | (1 << 9),
}
const WHEEL_HIGH: Record<DeckType, number> = { long: 5, short: 9 }

// Buffer reutilizado: el evaluador es sincrónico, así que no hay carreras.
const counts = new Int8Array(15)

/** Puntaje de exactamente 5 cartas. */
export function eval5(a: Card, b: Card, c: Card, d: Card, e: Card, deck: DeckType): number {
  const ra = rankOf(a), rb = rankOf(b), rc = rankOf(c), rd = rankOf(d), re = rankOf(e)
  const flush =
    suitOf(a) === suitOf(b) && suitOf(a) === suitOf(c) && suitOf(a) === suitOf(d) && suitOf(a) === suitOf(e)
  const mask = (1 << ra) | (1 << rb) | (1 << rc) | (1 << rd) | (1 << re)
  const str = STRENGTH[deck]

  // Cinco rangos distintos: puede ser escalera, color o carta alta.
  if (popcount(mask) === 5) {
    let straightHigh = 0
    const low = 31 - Math.clz32(mask & -mask)
    if (mask >> low === 0b11111) straightHigh = low + 4
    else if (mask === WHEEL[deck]) straightHigh = WHEEL_HIGH[deck]

    if (straightHigh) return ((flush ? str[Cat.StraightFlush] : str[Cat.Straight]) << 20) | (straightHigh << 16)
    // Carta alta o color: los 5 rangos de mayor a menor.
    let score = 0
    for (let r = 14; r >= 2; r--) if (mask & (1 << r)) score = (score << 4) | r
    return ((flush ? str[Cat.Flush] : str[Cat.HighCard]) << 20) | score
  }

  counts.fill(0)
  counts[ra]++; counts[rb]++; counts[rc]++; counts[rd]++; counts[re]++

  // Kickers ordenados por (cantidad, rango) descendente.
  let kickers = 0
  let maxCount = 0
  let pairs = 0
  for (let n = 4; n >= 1; n--) {
    for (let r = 14; r >= 2; r--) {
      if (counts[r] === n) {
        kickers = (kickers << 4) | r
        if (n > maxCount) maxCount = n
        if (n === 2) pairs++
      }
    }
  }

  let cat: Cat
  if (maxCount === 4) cat = Cat.Quads
  else if (maxCount === 3) cat = pairs > 0 ? Cat.FullHouse : Cat.Trips
  else cat = pairs === 2 ? Cat.TwoPair : Cat.Pair

  // Alinear a 5 nibbles para que kickers de manos con menos grupos comparen bien.
  const groups = popcount(mask)
  kickers <<= 4 * (5 - groups)
  return (str[cat] << 20) | kickers
}

function popcount(x: number): number {
  x -= (x >> 1) & 0x55555555
  x = (x & 0x33333333) + ((x >> 2) & 0x33333333)
  return (((x + (x >> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24
}

export function categoryOf(score: number, deck: DeckType): Cat {
  const strength = score >> 20
  return STRENGTH[deck].indexOf(strength) as Cat
}

// ── Mejor mano según el juego ──────────────────────────────────────────────

/** Combinaciones de k índices entre 0..n-1 (memoizadas). */
const comboCache = new Map<string, number[][]>()
export function combos(n: number, k: number): number[][] {
  const key = `${n}:${k}`
  const hit = comboCache.get(key)
  if (hit) return hit
  const out: number[][] = []
  const cur: number[] = []
  const rec = (start: number) => {
    if (cur.length === k) {
      out.push(cur.slice())
      return
    }
    for (let i = start; i < n; i++) {
      cur.push(i)
      rec(i + 1)
      cur.pop()
    }
  }
  rec(0)
  comboCache.set(key, out)
  return out
}

const pick = new Array<Card>(5)

/**
 * Puntaje de la mejor mano de 5 que se puede armar con `hole` y `board`
 * respetando cuántas cartas propias permite el juego. Devuelve -1 si con esas
 * cartas no se llega a 5 (por ejemplo, Omaha sin flop).
 */
export function bestScore(hole: readonly Card[], board: readonly Card[], game: GameId, deck: DeckType): number {
  let best = -1
  for (const k of GAMES[game].holeUse) {
    const fromBoard = 5 - k
    if (k > hole.length || fromBoard > board.length) continue
    const hc = combos(hole.length, k)
    const bc = combos(board.length, fromBoard)
    for (const h of hc) {
      for (const b of bc) {
        let i = 0
        for (const x of h) pick[i++] = hole[x]
        for (const x of b) pick[i++] = board[x]
        const s = eval5(pick[0], pick[1], pick[2], pick[3], pick[4], deck)
        if (s > best) best = s
      }
    }
  }
  return best
}

export interface BestHand {
  score: number
  cat: Cat
  /** Las 5 cartas que forman la mano, ordenadas por importancia. */
  cards: Card[]
  /** Cuáles de las 5 son propias. */
  fromHole: Card[]
  name: string
}

/** Como `bestScore`, pero también dice qué cartas usa y el nombre de la mano. */
export function bestHand(hole: readonly Card[], board: readonly Card[], game: GameId, deck: DeckType): BestHand | null {
  let best = -1
  let bestH: number[] = []
  let bestB: number[] = []
  for (const k of GAMES[game].holeUse) {
    const fromBoard = 5 - k
    if (k > hole.length || fromBoard > board.length) continue
    for (const h of combos(hole.length, k)) {
      for (const b of combos(board.length, fromBoard)) {
        const cs = [...h.map((x) => hole[x]), ...b.map((x) => board[x])]
        const s = eval5(cs[0], cs[1], cs[2], cs[3], cs[4], deck)
        if (s > best) {
          best = s
          bestH = h
          bestB = b
        }
      }
    }
  }
  if (best < 0) return null
  const fromHole = bestH.map((x) => hole[x])
  const cards = sortForDisplay([...fromHole, ...bestB.map((x) => board[x])], best, deck)
  const cat = categoryOf(best, deck)
  return { score: best, cat, cards, fromHole, name: handName(best, deck) }
}

/** Ordena las 5 cartas como se leería la mano: grupos primero, escaleras de arriba abajo. */
function sortForDisplay(cards: Card[], score: number, deck: DeckType): Card[] {
  const cat = categoryOf(score, deck)
  const count = new Map<number, number>()
  for (const c of cards) count.set(rankOf(c), (count.get(rankOf(c)) ?? 0) + 1)
  const isWheel = (cat === Cat.Straight || cat === Cat.StraightFlush) && ((score >> 16) & 15) === WHEEL_HIGH[deck]
  const rankKey = (r: number) => (isWheel && r === 14 ? 1 : r)
  return cards.slice().sort((x, y) => {
    const cx = count.get(rankOf(x))!
    const cy = count.get(rankOf(y))!
    if (cx !== cy) return cy - cx
    return rankKey(rankOf(y)) - rankKey(rankOf(x))
  })
}

const R = (r: number) => ({ 11: "J", 12: "Q", 13: "K", 14: "A" })[r] ?? String(r)

/** Nombre legible: "Par de K", "Full de 9 con 6", "Escalera al 9"… */
export function handName(score: number, deck: DeckType): string {
  const cat = categoryOf(score, deck)
  const k = (i: number) => (score >> (16 - 4 * i)) & 15
  switch (cat) {
    case Cat.StraightFlush:
      return k(0) === 14 ? "Escalera real" : `Escalera de color al ${R(k(0))}`
    case Cat.Quads:
      return `Póker de ${R(k(0))}`
    case Cat.FullHouse:
      return `Full de ${R(k(0))} con ${R(k(1))}`
    case Cat.Flush:
      return `Color al ${R(k(0))}`
    case Cat.Straight:
      return `Escalera al ${R(k(0))}`
    case Cat.Trips:
      return `Trío de ${R(k(0))}`
    case Cat.TwoPair:
      return `Doble par: ${R(k(0))} y ${R(k(1))}`
    case Cat.Pair:
      return `Par de ${R(k(0))}`
    default:
      return `Carta alta ${R(k(0))}`
  }
}
