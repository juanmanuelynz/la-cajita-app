// Rangos de apertura (open raise, "raise first in") de Hold'em No-Limit 6-max.
//
// Fuente: PokerStrategy.com, lecciones "No-Limit 6-max Pre-flop Ranges"
// (actualizadas el 12/03/2026). Armados a partir de 1,5 millones de manos de
// NL200 y la experiencia de jugadores ganadores, contra un "rival estándar".
// Copiados tal cual de cada lección; cada rango trae entre paréntesis la
// cantidad de combinaciones que publica la fuente y los tests verifican que
// el parser llegue exactamente a ese número.

import { rankOf, suitOf, type Card } from "./cards"

export type Position = "UTG" | "MP" | "CO" | "BU" | "SB"

export interface PositionRange {
  pos: Position
  name: string
  /** Para la frase "Estás …". */
  where: string
  /** Rango en notación estándar, como figura en la fuente. */
  range: string
  /** Combinaciones según la fuente. */
  combos: number
  /** Tamaño de la apertura según la fuente (en ciegas grandes). */
  openSize: string
  url: string
}

export const PREFLOP_SOURCE = {
  name: "PokerStrategy.com — No-Limit 6-max Pre-flop Ranges",
  url: "https://www.pokerstrategy.com/strategy/bss/no-limit-6-max-preflop-ranges/",
  updated: "2026-03-12",
}

export const OPEN_RANGES: Record<Position, PositionRange> = {
  UTG: {
    pos: "UTG",
    name: "3 lugares antes del que reparte (UTG)",
    where: "3 lugares antes del que reparte",
    range: "55+, ATs+, KTs+, QTs+, J9s+, T8s+, 97s+, 87s, 76s, AJo+, KQo",
    combos: 176,
    openSize: "3",
    url: "https://www.pokerstrategy.com/strategy/bss/utg-pre-flop-ranges/",
  },
  MP: {
    pos: "MP",
    name: "2 lugares antes del que reparte (MP)",
    where: "2 lugares antes del que reparte",
    // La fuente escribe "65s+" y su total (226) solo cierra si son los
    // conectores 65s, 76s, 87s, 98s, T9s y JTs: los dejamos explícitos.
    range: "22+, ATs+, A2s-A5s, KTs+, QTs+, 65s, 76s, 87s, 98s, T9s, JTs, J9s, T8s, 97s, AJo+, KJo+",
    combos: 226,
    openSize: "3",
    url: "https://www.pokerstrategy.com/strategy/bss/mp-pre-flop-ranges/",
  },
  CO: {
    pos: "CO",
    name: "justo antes del que reparte (CO)",
    where: "justo antes del que reparte",
    range: "22+, A2s+, K7s+, Q8s+, J7s+, T7s+, 96s+, 85s+, 75s+, 65s, 54s, A9o+, K9o+, Q9o+, J9o+, T9o, 98o",
    combos: 426,
    openSize: "2,5",
    url: "https://www.pokerstrategy.com/strategy/bss/co-pre-flop-ranges/",
  },
  BU: {
    pos: "BU",
    name: "el que reparte (BU)",
    where: "repartiendo",
    range:
      "22+, A2s+, K2s+, Q2s+, J3s+, T3s+, 94s+, 84s+, 73s+, 63s+, 53s+, 43s, A2o+, K5o+, Q7o+, J7o+, T6o+, 96o+, 86o+, 76o, 65o",
    combos: 826,
    openSize: "2",
    url: "https://www.pokerstrategy.com/strategy/bss/bu-pre-flop-ranges/",
  },
  SB: {
    pos: "SB",
    name: "la ciega chica (SB)",
    where: "en la ciega chica",
    range: "66+, A2s+, K7s+, Q7s+, J7s+, T7s+, 96s+, 85s+, 75s+, 64s+, 54s, A9o+, K9o+, Q9o+, J9o+, T9o, 98o",
    combos: 410,
    openSize: "3",
    url: "https://www.pokerstrategy.com/strategy/bss/sb-pre-flop-ranges/",
  },
}

/**
 * Posiciones que abren según cuántos hay en la mesa. La fuente es para 6
 * jugadores; con menos sacamos las primeras posiciones (adaptación nuestra,
 * no de la fuente: con 5 el primero juega como MP y con 4 como CO).
 */
export const POSITIONS_BY_TABLE: Record<4 | 5 | 6, Position[]> = {
  6: ["UTG", "MP", "CO", "BU", "SB"],
  5: ["MP", "CO", "BU", "SB"],
  4: ["CO", "BU", "SB"],
}

// ── Notación de rangos ─────────────────────────────────────────────────────

const RANKS = "23456789TJQKA"
const rv = (c: string) => {
  const i = RANKS.indexOf(c)
  if (i < 0) throw new Error(`Rango inválido: ${c}`)
  return i
}

/** Mano "clase" del 13×13: "AA", "AKs", "AKo". */
export type HandClass = string

/** Expande un rango tipo "22+, ATs+, A2s-A5s, KQo" a sus clases de mano. */
export function parseRange(text: string): Set<HandClass> {
  const out = new Set<HandClass>()
  for (const raw of text.split(",")) {
    const tok = raw.trim()
    if (!tok) continue
    if (tok.includes("-")) {
      const [a, b] = tok.split("-")
      if (a[0] === a[1]) {
        const [lo, hi] = [rv(a[0]), rv(b[0])].sort((x, y) => x - y)
        for (let i = lo; i <= hi; i++) out.add(RANKS[i] + RANKS[i])
      } else {
        const [lo, hi] = [rv(a[1]), rv(b[1])].sort((x, y) => x - y)
        for (let k = lo; k <= hi; k++) out.add(a[0] + RANKS[k] + a.slice(2))
      }
      continue
    }
    const plus = tok.endsWith("+")
    const t = plus ? tok.slice(0, -1) : tok
    if (t[0] === t[1]) {
      if (plus) for (let i = rv(t[0]); i < 13; i++) out.add(RANKS[i] + RANKS[i])
      else out.add(t)
      continue
    }
    const suits = t.length > 2 ? [t.slice(2)] : ["s", "o"]
    for (const s of suits) {
      if (!plus) out.add(t[0] + t[1] + s)
      // "+" sube la segunda carta hasta una menos que la primera (A2s+ = A2s…AKs).
      else for (let k = rv(t[1]); k < rv(t[0]); k++) out.add(t[0] + RANKS[k] + s)
    }
  }
  return out
}

const RANK_WORDS: Record<string, string> = { T: "10" }

/** "98s" → "9 y 8 del mismo palo", "AKo" → "A y K de distinto palo", "77" → "par de 7". */
export function describeClass(h: HandClass): string {
  const r = (c: string) => RANK_WORDS[c] ?? c
  if (h.length === 2) return `par de ${r(h[0])}`
  return `${r(h[0])} y ${r(h[1])} ${h.endsWith("s") ? "del mismo palo" : "de distinto palo"}`
}

export const comboCount = (h: HandClass) => (h.length === 2 ? 6 : h.endsWith("s") ? 4 : 12)

/** Clase de mano de dos cartas concretas. */
export function handClass(a: Card, b: Card): HandClass {
  const [hi, lo] = rankOf(a) >= rankOf(b) ? [a, b] : [b, a]
  const H = RANKS[rankOf(hi) - 2]
  const L = RANKS[rankOf(lo) - 2]
  if (H === L) return H + L
  return H + L + (suitOf(hi) === suitOf(lo) ? "s" : "o")
}

/** Las clases en el orden de la grilla (13×13; 9×9 en mazo corto). Fila = primera carta, de A para abajo. */
export function gridClasses(deck: "long" | "short" = "long"): HandClass[][] {
  const order = RANKS.slice(deck === "short" ? 4 : 0).split("").reverse()
  return order.map((r, i) =>
    order.map((c, j) => (i === j ? r + c : i < j ? r + c + "s" : c + r + "o")),
  )
}

const parsed = new Map<Position, Set<HandClass>>()
export function openRange(pos: Position): Set<HandClass> {
  let s = parsed.get(pos)
  if (!s) parsed.set(pos, (s = parseRange(OPEN_RANGES[pos].range)))
  return s
}

/** Porcentaje de manos que abre (combinaciones / 1326). */
export const openPercent = (pos: Position) => OPEN_RANGES[pos].combos / 1326
