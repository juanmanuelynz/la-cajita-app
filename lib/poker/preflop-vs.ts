// Antes del flop con ciegas, cuando hay una subida antes que vos (pagar,
// resubir o fold) o cuando abriste y te resuben (pagar, resubir otra vez o
// fold). Hold'em No-Limit, 6 jugadores, solo mazo largo.
//
// Fuente: las mismas lecciones de PokerStrategy.com que los rangos de apertura
// (ver preflop.ts). Los datos están en preflop-vs-data.ts, copiados tal cual.
// La fuente a veces juega distinto la misma mano según los palos (por ejemplo,
// paga con A♠A♣ y resube con los otros ases): es para que el rival no sepa que
// cuando pagás nunca tenés ases. Por eso todo se resuelve por combinación (las
// dos cartas con su palo), no por "clase" de mano.

import { makeCard, makeDeck, shuffle, type Card, type Rng } from "./cards"
import { RANKS_ORDER, handClass, type HandClass } from "./preflop"
import { VS_SPOTS } from "./preflop-vs-data"

export type Seat6 = "UTG" | "MP" | "CO" | "BU" | "SB" | "BB"
/** Orden en que se habla antes del flop en una mesa de 6. */
export const SEATS6: Seat6[] = ["UTG", "MP", "CO", "BU", "SB", "BB"]

export type VsAction = "fold" | "call" | "raise"

export interface VsSpotData {
  /** vsOpen: alguien subió antes que vos. vs3bet: abriste y te resubieron. */
  kind: "vsOpen" | "vs3bet"
  hero: Seat6
  villain: Seat6
  /** Título de la sección en la fuente. */
  source: string
  url: string
  /** "defend" es el rango completo; el resto, lo que se hace con cada parte. */
  lines: { label: string; action: "defend" | "call" | "raise"; range: string; combos: number }[]
}

export const VS_SOURCE_UPDATED = "2026-03-12"

// ── Combinaciones ──────────────────────────────────────────────────────────

const SUIT_CODES: Record<string, number> = { s: 0, h: 1, d: 2, c: 3 }
const rankIndex = (c: string) => {
  const i = RANKS_ORDER.indexOf(c)
  if (i < 0) throw new Error(`Rango inválido: ${c}`)
  return i // 0 = "2" … 12 = "A"
}
const card = (r: number, s: number) => makeCard(r + 2, s)

/** Clave de una combinación (dos cartas, sin importar el orden). */
export const comboKey = (a: Card, b: Card) => (a < b ? `${a}-${b}` : `${b}-${a}`)

function pairCombos(r: number, out: Set<string>) {
  for (let x = 0; x < 4; x++) for (let y = x + 1; y < 4; y++) out.add(comboKey(card(r, x), card(r, y)))
}
function twoCombos(a: number, b: number, kind: "s" | "o" | "", out: Set<string>) {
  for (let x = 0; x < 4; x++)
    for (let y = 0; y < 4; y++) {
      if (kind === "s" && x !== y) continue
      if (kind === "o" && x === y) continue
      out.add(comboKey(card(a, x), card(b, y)))
    }
}

/**
 * Expande un rango en notación de la fuente a combinaciones: "QQ-88", "55+",
 * "AQs+", "AQs-A9s", "JTs-98s" (conectores que bajan juntos), "KQ" (las dos:
 * mismo palo y distinto) y combinaciones sueltas como "AsAc".
 */
export function parseCombos(text: string): Set<string> {
  const out = new Set<string>()
  for (const raw of text.split(",")) {
    const t = raw.trim()
    if (!t) continue
    let m = /^([2-9TJQKA])([shdc])([2-9TJQKA])([shdc])$/.exec(t)
    if (m) {
      out.add(comboKey(card(rankIndex(m[1]), SUIT_CODES[m[2]]), card(rankIndex(m[3]), SUIT_CODES[m[4]])))
      continue
    }
    m = /^([2-9TJQKA])\1(\+)?$/.exec(t)
    if (m) {
      const r = rankIndex(m[1])
      for (let i = r; i <= (m[2] ? 12 : r); i++) pairCombos(i, out)
      continue
    }
    m = /^([2-9TJQKA])\1-([2-9TJQKA])\2$/.exec(t)
    if (m) {
      const [lo, hi] = [rankIndex(m[1]), rankIndex(m[2])].sort((x, y) => x - y)
      for (let i = lo; i <= hi; i++) pairCombos(i, out)
      continue
    }
    m = /^([2-9TJQKA])([2-9TJQKA])([so]?)\+$/.exec(t)
    if (m) {
      // "+" sube la segunda carta hasta una menos que la primera (ATs+ = ATs…AKs).
      const a = rankIndex(m[1])
      for (let k = rankIndex(m[2]); k < a; k++) twoCombos(a, k, m[3] as "s" | "o" | "", out)
      continue
    }
    m = /^([2-9TJQKA])([2-9TJQKA])([so]?)-([2-9TJQKA])([2-9TJQKA])\3$/.exec(t)
    if (m) {
      const [a, b, c, d] = [m[1], m[2], m[4], m[5]].map(rankIndex)
      const kind = m[3] as "s" | "o" | ""
      if (a === c) {
        // Misma primera carta: AQs-A9s.
        for (let k = Math.min(b, d); k <= Math.max(b, d); k++) twoCombos(a, k, kind, out)
      } else {
        // Las dos bajan juntas: JTs-98s = JTs, T9s, 98s.
        if (a - b !== c - d) throw new Error(`Rango inválido: ${t}`)
        for (let top = Math.min(a, c); top <= Math.max(a, c); top++) twoCombos(top, top - (a - b), kind, out)
      }
      continue
    }
    m = /^([2-9TJQKA])([2-9TJQKA])([so]?)$/.exec(t)
    if (m) {
      twoCombos(rankIndex(m[1]), rankIndex(m[2]), m[3] as "s" | "o" | "", out)
      continue
    }
    throw new Error(`Rango inválido: ${t}`)
  }
  return out
}

// ── Situaciones ────────────────────────────────────────────────────────────

export interface VsSpot extends VsSpotData {
  /** Combinación → qué hacer (lo que no está, fold). */
  actions: Map<string, Exclude<VsAction, "fold">>
  /** Línea de la fuente de cada combinación ("Call", "3-Bet/Fold"…). */
  labels: Map<string, string>
  defending: { range: string; combos: number }
}

let spots: VsSpot[] | null = null
/** Las 30 situaciones de la fuente, con sus combinaciones ya expandidas. */
export function vsSpots(): VsSpot[] {
  if (spots) return spots
  spots = VS_SPOTS.map((s) => {
    const actions = new Map<string, Exclude<VsAction, "fold">>()
    const labels = new Map<string, string>()
    for (const l of s.lines) {
      if (l.action === "defend") continue
      for (const k of parseCombos(l.range)) {
        actions.set(k, l.action)
        labels.set(k, l.label)
      }
    }
    const def = s.lines.find((l) => l.action === "defend")!
    return { ...s, actions, labels, defending: { range: def.range, combos: def.combos } }
  })
  return spots
}

export function vsAction(spot: VsSpot, cards: readonly Card[]): VsAction {
  return spot.actions.get(comboKey(cards[0], cards[1])) ?? "fold"
}

/** Qué se hace con cada combinación de una clase de mano (para la grilla y el "truco" de los palos). */
export function classActions(spot: VsSpot, cls: HandClass): Record<VsAction, Card[][]> {
  const out: Record<VsAction, Card[][]> = { fold: [], call: [], raise: [] }
  for (const pair of classCombos(cls)) out[vsAction(spot, pair)].push(pair)
  return out
}

/** Las combinaciones concretas de una clase ("AKs" → 4, "AKo" → 12, "QQ" → 6). */
export function classCombos(cls: HandClass): Card[][] {
  const a = rankIndex(cls[0])
  const b = rankIndex(cls[1])
  const res: Card[][] = []
  for (let x = 0; x < 4; x++)
    for (let y = 0; y < 4; y++) {
      if (a === b ? y <= x : cls[2] === "s" ? x !== y : x === y) continue
      res.push([card(a, x), card(b, y)])
    }
  return res
}

// ── Ejercicio ──────────────────────────────────────────────────────────────

export interface PreflopVsDrill {
  kind: "preflopVs"
  situation: "vsOpen" | "vs3bet"
  hero: Seat6
  villain: Seat6
  cards: Card[]
  hand: HandClass
  answer: VsAction
  /** Línea de la fuente ("3-Bet/5-Bet"…) o null si es fold. */
  label: string | null
  /** La fuente juega distinto esta mano según los palos. */
  mixed: boolean
}

/** Parte de las manos que salen del rango que se defiende (el resto, al azar: casi siempre fold). */
const FROM_RANGE = 0.6

/**
 * Una situación de la fuente (del tipo pedido) y una mano: 6 de cada 10 salen
 * de lo que la fuente defiende (si no, casi todo sería fold).
 */
export function makePreflopVs(situation: "vsOpen" | "vs3bet", rng: Rng = Math.random): PreflopVsDrill {
  const pool = vsSpots().filter((s) => s.kind === situation)
  const spot = pool[Math.floor(rng() * pool.length)]
  let cards: Card[]
  if (rng() < FROM_RANGE) {
    const keys = [...spot.actions.keys()]
    const [a, b] = keys[Math.floor(rng() * keys.length)].split("-").map(Number)
    cards = rng() < 0.5 ? [a, b] : [b, a]
  } else {
    cards = shuffle(makeDeck("long"), rng).slice(0, 2)
  }
  const hand = handClass(cards[0], cards[1])
  const byAction = classActions(spot, hand)
  const mixed = (["fold", "call", "raise"] as const).filter((a) => byAction[a].length > 0).length > 1
  return {
    kind: "preflopVs",
    situation,
    hero: spot.hero,
    villain: spot.villain,
    cards,
    hand,
    answer: vsAction(spot, cards),
    label: spot.labels.get(comboKey(cards[0], cards[1])) ?? null,
    mixed,
  }
}

export function findVsSpot(d: Pick<PreflopVsDrill, "situation" | "hero" | "villain">): VsSpot {
  return vsSpots().find((s) => s.kind === d.situation && s.hero === d.hero && s.villain === d.villain)!
}
