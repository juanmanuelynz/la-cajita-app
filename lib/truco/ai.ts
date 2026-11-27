// La máquina del truco: juega razonablemente y a veces miente (como en el truco
// de verdad). Port del módulo `ai` del artefacto "Truco argentino". Pura: recibe
// el estado y el `rng`, devuelve la acción.
//
// Tres niveles (BOT_LEVELS). "media" es la máquina del artefacto, sin cambios.
// "fácil" no miente, quiere casi todo y tira primero su mejor carta (el error
// de quien empieza). "difícil" calcula con más muestras, miente un poco más y
// usa lo que ya se sabe: si el rival dijo sus tantos, sus cartas tienen que
// sumar eso. Son reglas nuestras, sin fuente: lo fuertes que son se mide con
// scripts/lab/truco-levels.ts (resultados en docs/plan-truco.md).

import type { Rng } from "../poker/cards"
import {
  compare,
  currentTrick,
  deck,
  envidoPoints,
  faltaValue,
  florPoints,
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

export type BotLevel = "facil" | "media" | "dificil"
export const BOT_LEVELS: readonly BotLevel[] = ["facil", "media", "dificil"]
export const BOT_LEVEL_LABEL: Record<BotLevel, string> = { facil: "Fácil", media: "Media", dificil: "Difícil" }

interface Profile {
  /** Manos del rival que prueba para calcular sus chances. */
  samples: number
  /** Si usa los tantos que dijo el rival para descartar manos imposibles. */
  useEnvidoInfo: boolean
  /** Cómo elige la carta: "search" prueba cada una simulando el resto de la mano. */
  play: "naive" | "smart" | "search"
  // Envido
  envCallAt: number
  envBluff: number
  envRealAt: number
  envQuieroBluff: number
  /** Con envido para cantar y un truco pendiente, chance de contestar con envido. */
  envFirst: number
  // Truco
  trucoNeed: number
  trucoStep: number
  lieBelow: number
  lieProb: number
  quieroBase: number
  quieroStep: number
  quieroBluff: number
  raiseAt: number
}

const PROFILES: Record<BotLevel, Profile> = {
  media: {
    samples: 160,
    useEnvidoInfo: false,
    play: "smart",
    envCallAt: 27,
    envBluff: 0.1,
    envRealAt: 30,
    envQuieroBluff: 0.05,
    envFirst: 0.85,
    trucoNeed: 0.66,
    trucoStep: 0.06,
    lieBelow: 0.3,
    lieProb: 0.08,
    quieroBase: 0.42,
    quieroStep: 0.06,
    quieroBluff: 0.07,
    raiseAt: 0.82,
  },
  facil: {
    samples: 60,
    useEnvidoInfo: false,
    play: "naive",
    envCallAt: 29,
    envBluff: 0,
    envRealAt: 32,
    envQuieroBluff: 0.15,
    envFirst: 0.85,
    trucoNeed: 0.75,
    trucoStep: 0.06,
    lieBelow: 0,
    lieProb: 0,
    quieroBase: 0.3,
    quieroStep: 0.04,
    quieroBluff: 0.15,
    raiseAt: 0.9,
  },
  dificil: {
    samples: 320,
    useEnvidoInfo: true,
    play: "search",
    envCallAt: 27,
    envBluff: 0.12,
    envRealAt: 30,
    envQuieroBluff: 0.03,
    envFirst: 0.9,
    trucoNeed: 0.6,
    trucoStep: 0.06,
    lieBelow: 0.3,
    lieProb: 0.12,
    quieroBase: 0.36,
    quieroStep: 0.05,
    quieroBluff: 0.05,
    raiseAt: 0.8,
  },
}

const other = (p: Player): Player => (1 - p) as Player

/** Probabilidad de ganar la mano, probando manos posibles del rival. */
export function winChance(
  g: GameState,
  p: Player,
  rng: Rng = Math.random,
  samples = 160,
  useEnvidoInfo = false,
  /** Si se pasa, `p` tira esa carta (índice en su mano) en la baza actual. */
  force?: number,
): number {
  const h = g.hand
  const o = other(p)
  const playedByO = h.tricks.flatMap((t) => (t.cards[o] ? [t.cards[o]!] : []))
  const seen = [...h.dealt[p], ...playedByO]
  const pool = deck().filter((c) => !seen.some((s) => sameCard(s, c)))
  const need = h.cards[o].length
  // Tantos que dijo el rival (se dicen en voz alta al resolver el envido).
  const said = useEnvidoInfo && h.envido.points ? h.envido.points[o] : null
  let wins = 0
  let counted = 0
  for (let s = 0; s < samples; s++) {
    let opp: TrucoCard[] = []
    // Con los tantos del rival se descartan las manos que no suman eso (hasta 30 intentos).
    for (let tries = 0; tries < 30; tries++) {
      opp = []
      const left = pool.slice()
      for (let i = 0; i < need; i++) opp.push(left.splice(Math.floor(rng() * left.length), 1)[0])
      if (said === null || envidoPoints([...playedByO, ...opp]) === said) break
    }
    wins += playout(g, p, h.cards[p].slice(), opp, force) === p ? 1 : 0
    counted++
  }
  return wins / counted
}

function playout(g: GameState, p: Player, mine: TrucoCard[], theirs: TrucoCard[], force?: number): Player {
  const h = g.hand
  const hands = p === 0 ? [mine, theirs] : [theirs, mine]
  const results: TrickResult[] = h.tricks.filter((t) => t.winner !== null).map((t) => t.winner as TrickResult)
  const t = currentTrick(g)
  let cards = t.cards.slice()
  if (force !== undefined && !cards[p]) cards[p] = mine.splice(force, 1)[0]
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
export function chooseCard(g: GameState, p: Player, play: Profile["play"] = "smart", rng: Rng = Math.random, pr?: Profile): number {
  if (play === "search" && g.hand.cards[p].length > 1) {
    // Prueba cada carta simulando el resto de la mano contra manos posibles del rival.
    let best = 0
    let bestWin = -1
    g.hand.cards[p].forEach((_, i) => {
      const w = winChance(g, p, rng, pr?.samples ?? 160, pr?.useEnvidoInfo ?? false, i)
      if (w > bestWin + 1e-9) {
        best = i
        bestWin = w
      }
    })
    return best
  }
  const h = g.hand
  const mine = h.cards[p].map((c, i) => ({ c, i })).sort((a, b) => rank(a.c) - rank(b.c))
  const t = currentTrick(g)
  const theirs = t.cards[other(p)]
  const results = h.tricks.filter((x) => x.winner !== null).map((x) => x.winner)
  if (play === "naive") {
    // Principiante: si puede ganar, gana con la más alta; si no, tira la peor. Abre con la mejor.
    if (theirs) {
      const best = mine[mine.length - 1]
      return rank(best.c) > rank(theirs) ? best.i : mine[0].i
    }
    return mine[mine.length - 1].i
  }
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

function envidoDecision(g: GameState, p: Player, l: Legal, rng: Rng, pr: Profile): TrucoAction | null {
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
    return { type: pts >= need || chance(pr.envQuieroBluff) ? "quiero" : "noQuiero" }
  }
  if (!l.envido.length) return null
  const behind = g.score[other(p)] - g.score[p]
  if (pts >= 32 && behind > 8 && l.envido.includes("falta")) return { type: "envido", call: "falta" }
  if (pts >= pr.envRealAt) return { type: "envido", call: chance(0.5) ? "real" : "envido" }
  if (pts >= pr.envCallAt || chance(pr.envBluff)) return { type: "envido", call: "envido" }
  return null
}

/**
 * Flor (igual en todos los niveles): siempre la canta. Si los dos tienen, decide
 * por sus puntos de flor (de 20 a 38; el mano gana los empates, así que cuenta 1 más).
 */
function florDecision(g: GameState, p: Player, l: Legal): TrucoAction | null {
  if (l.flor) return { type: "flor" }
  const pd = g.hand.pending
  if (!pd || pd.kind !== "flor") return null
  const pts = (florPoints(g.hand.dealt[p]) ?? 0) + (g.mano === p ? 1 : 0)
  if (pd.call === "flor") {
    if (pts >= 36) return { type: "contraflorResto" }
    if (pts >= 33) return { type: "contraflor" }
    return { type: "achico" }
  }
  if (pd.call === "contraflor") {
    if (pts >= 36 && l.contraflorResto) return { type: "contraflorResto" }
    return { type: pts >= 32 ? "quiero" : "noQuiero" }
  }
  return { type: pts >= 34 ? "quiero" : "noQuiero" }
}

/** La acción de la máquina para el jugador `p` (al que le toca). */
export function decide(g: GameState, p: Player, rng: Rng = Math.random, level: BotLevel = "media"): TrucoAction {
  const pr = PROFILES[level]
  const l = legal(g, p)
  const pd = g.hand.pending
  const chance = (x: number) => rng() < x

  const flor = florDecision(g, p, l)
  if (flor) return flor

  const env = envidoDecision(g, p, l, rng, pr)
  if (pd && pd.kind === "envido") return env!
  if (env && (!pd || chance(pr.envFirst))) return env

  const win = winChance(g, p, rng, pr.samples, pr.useEnvidoInfo)
  if (pd && pd.kind === "truco") {
    if (l.truco && win > pr.raiseAt) return { type: "truco" }
    const need = pr.quieroBase + pr.quieroStep * pd.level
    return { type: win >= need || chance(pr.quieroBluff) ? "quiero" : "noQuiero" }
  }

  if (l.truco) {
    const need = pr.trucoNeed + pr.trucoStep * (l.truco - 1)
    if (win >= need) return { type: "truco" }
    if (l.truco === 1 && win < pr.lieBelow && chance(pr.lieProb)) return { type: "truco" } // mentira
  }
  return { type: "play", index: chooseCard(g, p, pr.play, rng, pr) }
}
