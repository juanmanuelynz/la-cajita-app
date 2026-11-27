// La máquina del truco: juega razonablemente y a veces miente (como en el truco
// de verdad). Port del módulo `ai` del artefacto "Truco argentino". Pura: recibe
// el estado y el `rng`, devuelve la acción.

import type { Rng } from "../poker/cards"
import {
  compare,
  currentTrick,
  deck,
  envidoPoints,
  faltaValue,
  handWinner,
  legal,
  rank,
  sameCard,
  type GameState,
  type Legal,
  type Player,
  type TrickResult,
  type TrucoAction,
  type TrucoCard,
} from "./engine"

const other = (p: Player): Player => (1 - p) as Player

/** Probabilidad de ganar la mano, probando manos posibles del rival. */
export function winChance(g: GameState, p: Player, rng: Rng = Math.random, samples = 160): number {
  const h = g.hand
  const o = other(p)
  const seen = [...h.dealt[p], ...h.tricks.flatMap((t) => (t.cards[o] ? [t.cards[o]!] : []))]
  const pool = deck().filter((c) => !seen.some((s) => sameCard(s, c)))
  const need = h.cards[o].length
  let wins = 0
  for (let s = 0; s < samples; s++) {
    const opp: TrucoCard[] = []
    const left = pool.slice()
    for (let i = 0; i < need; i++) opp.push(left.splice(Math.floor(rng() * left.length), 1)[0])
    wins += playout(g, p, h.cards[p].slice(), opp) === p ? 1 : 0
  }
  return wins / samples
}

function playout(g: GameState, p: Player, mine: TrucoCard[], theirs: TrucoCard[]): Player {
  const h = g.hand
  const hands = p === 0 ? [mine, theirs] : [theirs, mine]
  const results: TrickResult[] = h.tricks.filter((t) => t.winner !== null).map((t) => t.winner as TrickResult)
  const t = currentTrick(g)
  let cards = t.cards.slice()
  let lead = t.lead
  for (;;) {
    for (const q of [lead, other(lead)]) {
      if (cards[q]) continue
      cards[q] = pick(hands[q], cards[other(q)])
    }
    const w = compare(cards[0]!, cards[1]!)
    results.push(w)
    const hw = handWinner(results, g.mano)
    if (hw !== null) return hw
    lead = w === -1 ? g.mano : w
    cards = [null, null]
  }
}

function pick(hand: TrucoCard[], against: TrucoCard | null): TrucoCard {
  hand.sort((a, b) => rank(a) - rank(b))
  if (!against) return hand.pop()!
  const i = hand.findIndex((c) => rank(c) > rank(against))
  return hand.splice(i === -1 ? 0 : i, 1)[0]
}

/** Qué carta tirar (índice en la mano). */
export function chooseCard(g: GameState, p: Player): number {
  const h = g.hand
  const mine = h.cards[p].map((c, i) => ({ c, i })).sort((a, b) => rank(a.c) - rank(b.c))
  const t = currentTrick(g)
  const theirs = t.cards[other(p)]
  const results = h.tricks.filter((x) => x.winner !== null).map((x) => x.winner)
  if (theirs) {
    const beat = mine.find((x) => rank(x.c) > rank(theirs))
    const tie = mine.find((x) => rank(x.c) === rank(theirs))
    if (beat) return beat.i
    // Una parda en primera conviene si tengo algo bueno para después.
    if (tie && results.length === 0 && mine.some((x) => rank(x.c) >= 10)) return tie.i
    if (tie && results.length > 0 && results[0] === p) return tie.i
    return mine[0].i
  }
  // En primera, la del medio: guardo la mejor.
  if (results.length === 0) return mine.length === 3 ? mine[1].i : mine[mine.length - 1].i
  return mine[mine.length - 1].i
}

function envidoDecision(g: GameState, p: Player, l: Legal, rng: Rng): TrucoAction | null {
  const h = g.hand
  const chance = (x: number) => rng() < x
  const pts = envidoPoints(h.dealt[p]) + (g.mano === p ? 1 : 0)
  const calls = h.envido.calls
  if (h.pending && h.pending.kind === "envido") {
    const last = calls[calls.length - 1]
    const falta = faltaValue(g.score, g.target)
    const need = last === "falta" ? (falta > 6 ? 30 : 28) : last === "real" || calls.length > 1 ? 27 : 25
    if (pts >= 31 && l.envido.includes("real") && calls.length < 3) return { type: "envido", call: "real" }
    if (pts >= 33 && l.envido.includes("falta")) return { type: "envido", call: "falta" }
    return { type: pts >= need || chance(0.05) ? "quiero" : "noQuiero" }
  }
  if (!l.envido.length) return null
  const behind = g.score[other(p)] - g.score[p]
  if (pts >= 32 && behind > 8 && l.envido.includes("falta")) return { type: "envido", call: "falta" }
  if (pts >= 30) return { type: "envido", call: chance(0.5) ? "real" : "envido" }
  if (pts >= 27 || chance(0.1)) return { type: "envido", call: "envido" }
  return null
}

/** La acción de la máquina para el jugador `p` (al que le toca). */
export function decide(g: GameState, p: Player, rng: Rng = Math.random): TrucoAction {
  const l = legal(g, p)
  const pd = g.hand.pending
  const chance = (x: number) => rng() < x

  const env = envidoDecision(g, p, l, rng)
  if (pd && pd.kind === "envido") return env!
  if (env && (!pd || chance(0.85))) return env

  const win = winChance(g, p, rng)
  if (pd && pd.kind === "truco") {
    if (l.truco && win > 0.82) return { type: "truco" }
    const need = 0.42 + 0.06 * pd.level
    return { type: win >= need || chance(0.07) ? "quiero" : "noQuiero" }
  }

  if (l.truco) {
    const need = 0.66 + 0.06 * (l.truco - 1)
    if (win >= need) return { type: "truco" }
    if (l.truco === 1 && win < 0.3 && chance(0.08)) return { type: "truco" } // mentira
  }
  return { type: "play", index: chooseCard(g, p) }
}
