// Cartas como enteros: carta = (rango - 2) * 4 + palo.
// Rango 2..14 (14 = As), palo 0..3 (♠ ♥ ♦ ♣). Enteros en vez de objetos para
// que el evaluador y las simulaciones de equity no creen basura.

export type Card = number

/** Mazo largo (52) o corto (36: sin 2, 3, 4 ni 5). */
export type DeckType = "long" | "short"

export const SUITS = ["♠", "♥", "♦", "♣"] as const
export type SuitSymbol = (typeof SUITS)[number]

export const RANK_LABELS: Record<number, string> = {
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
}

export const makeCard = (rank: number, suit: number): Card => (rank - 2) * 4 + suit
export const rankOf = (c: Card) => (c >> 2) + 2
export const suitOf = (c: Card) => c & 3

/** Rango más bajo del mazo. */
export const minRank = (deck: DeckType) => (deck === "short" ? 6 : 2)

/** Todas las cartas del mazo, ordenadas de As a la más baja y por palo. */
export function makeDeck(deck: DeckType): Card[] {
  const cards: Card[] = []
  for (let r = 14; r >= minRank(deck); r--) {
    for (let s = 0; s < 4; s++) cards.push(makeCard(r, s))
  }
  return cards
}

export const deckSize = (deck: DeckType) => (deck === "short" ? 36 : 52)

export function cardLabel(c: Card): string {
  return RANK_LABELS[rankOf(c)] + SUITS[suitOf(c)]
}

export const isRedSuit = (suit: number) => suit === 1 || suit === 2

/**
 * Lee cartas escritas como "As Kh Td 9c" (para tests y ejemplos).
 * Palos: s ♠, h ♥, d ♦, c ♣. T o 10 para el diez.
 */
export function parseCards(text: string): Card[] {
  const RANKS: Record<string, number> = {
    "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
    T: 10, "10": 10, J: 11, Q: 12, K: 13, A: 14,
  }
  const SUIT_CODES: Record<string, number> = { s: 0, h: 1, d: 2, c: 3 }
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => {
      const rank = RANKS[tok.slice(0, -1).toUpperCase()]
      const suit = SUIT_CODES[tok.slice(-1).toLowerCase()]
      if (rank === undefined || suit === undefined) throw new Error(`Carta inválida: ${tok}`)
      return makeCard(rank, suit)
    })
}

/** Generador pseudoaleatorio con semilla (mulberry32), para tests reproducibles. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Rng = () => number

/** Fisher–Yates sobre una copia. */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

/** Cartas del mazo que no están en `used`. */
export function remainingDeck(deck: DeckType, used: readonly Card[]): Card[] {
  const taken = new Set(used)
  return makeDeck(deck).filter((c) => !taken.has(c))
}
