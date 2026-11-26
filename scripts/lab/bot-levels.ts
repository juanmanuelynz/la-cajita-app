// Laboratorio de La Cajita: ¿cada nivel de bot le gana al anterior?
//
// Método: mesas solo de bots, con semilla fija. En cada mesa se sientan, en
// asientos alternados, jugadores de dos tipos (por ejemplo 3 "media" y 3
// "fácil") y juegan N manos con luz; cuando uno se queda sin fichas pide otra
// cajita. Se mide cuánto gana o pierde cada tipo, en luces cada 100 manos
// (luz/100). Además de los niveles hay jugadores de referencia: "azar"
// (pasa, paga, sube o se va al azar), "pagador" (paga todo, nunca sube) y
// "miedoso" (nunca apuesta y se va el 70% de las veces que le apuestan) y
// "maníaco" (apuesta el pozo la mitad de las veces que puede, con cualquier cosa).
// Nano aprende de todos sus rivales (en la app, solo de vos): contra el
// pagador, el miedoso y el maníaco tiene que ganar más que difícil.
//
// Correr: npx tsx scripts/lab/bot-levels.ts [manos] [simulaciones] [semilla] [juego] [mazo] [jugadores] [solo-pares-con]
// (el último, opcional, deja solo los pares donde juega ese tipo; por ejemplo "nano").

import { seededRng, type DeckType, type Rng } from "../../lib/poker/cards"
import { addHandToReads, botAct, botSeatId, botWantsCajita, EMPTY_READS, type BotLevel, type PlayerReads } from "../../lib/poker/bot"
import { act, createTable, DEFAULT_CONFIG, legalActions, netResult, requestCajita, startHand, type Action, type TableState } from "../../lib/poker/table"
import type { GameId } from "../../lib/poker/variants"

const HANDS = Number(process.argv[2] ?? 600)
const TRIALS = Number(process.argv[3] ?? 120)
const SEED = Number(process.argv[4] ?? 2026)
const GAME = (process.argv[5] ?? "holdem") as GameId
const DECK = (process.argv[6] ?? "long") as DeckType
const PLAYERS = Number(process.argv[7] ?? 6)
const ONLY = process.argv[8]

type Ref = "azar" | "pagador" | "miedoso" | "maniaco"
type Kind = BotLevel | Ref
const isRef = (k: Kind): k is Ref => k === "azar" || k === "pagador" || k === "miedoso" || k === "maniaco"

function refAction(t: TableState, kind: Ref, rng: Rng): Action {
  const l = legalActions(t)!
  if (kind === "pagador") return l.canCheck ? { type: "check" } : { type: "call" }
  if (kind === "miedoso") return l.canCheck ? { type: "check" } : rng() < 0.7 ? { type: "fold" } : { type: "call" }
  if (kind === "maniaco") {
    const h = t.hand!
    const pot = h.players.reduce((s, p) => s + p.committed, 0)
    const to = Math.max(l.minTo, Math.min(l.maxTo, Math.round((h.currentBet + pot) / 100) * 100))
    if (l.canRaise && rng() < (l.canCheck ? 0.5 : 0.2)) return { type: "raise", to }
    if (l.canCheck) return { type: "check" }
    return rng() < 0.15 ? { type: "fold" } : { type: "call" }
  }
  const r = rng()
  if (r < 0.2 && l.canRaise) return { type: "raise", to: l.minTo }
  if (r < 0.45 && !l.canCheck) return { type: "fold" }
  return l.canCheck ? { type: "check" } : { type: "call" }
}

/** Luces cada 100 manos que gana cada tipo (promedio por asiento). */
function match(a: Kind, b: Kind, seed: number) {
  const rng = seededRng(seed)
  const kinds: Kind[] = Array.from({ length: PLAYERS }, (_, i) => (i % 2 === 0 ? a : b))
  const players = kinds.map((k, i) => ({
    id: isRef(k) ? `ref:${k}:${i}` : botSeatId(k, i),
    name: `${k} ${i}`,
  }))
  // Varios asientos pueden ser "nano": el id se repite, pero cada uno aprende por su lado (reads por asiento).
  let t = createTable({ ...DEFAULT_CONFIG, variants: [{ game: GAME, deck: DECK }] }, players)
  const reads: Record<number, PlayerReads> = {}
  for (let i = 0; i < PLAYERS; i++) reads[i] = EMPTY_READS
  for (let n = 0; n < HANDS; n++) {
    t.seats.forEach((_, i) => {
      if (botWantsCajita(t, i)) t = requestCajita(t, i)
    })
    t = startHand(t, rng)
    while (t.hand!.toAct !== null) {
      const seat = t.hand!.toAct
      const k = kinds[seat]
      if (isRef(k)) t = act(t, refAction(t, k, rng))
      else t = botAct(t, rng, { trials: TRIALS, reads }).table
    }
    for (let i = 0; i < PLAYERS; i++) reads[i] = addHandToReads(reads[i], t.hand!, i, t.config.structure)
  }
  const per = (k: Kind) => {
    const seats = kinds.map((x, i) => (x === k ? i : -1)).filter((i) => i >= 0)
    const net = seats.reduce((s, i) => s + netResult(t, i), 0) / seats.length
    return (net / t.config.luz / HANDS) * 100
  }
  return { a: per(a), b: per(b) }
}

const pairs: [Kind, Kind][] = [
  ["facil", "azar"],
  ["facil", "pagador"],
  ["media", "facil"],
  ["dificil", "media"],
  ["dificil", "facil"],
  ["nano", "dificil"],
  ["nano", "media"],
  ["dificil", "pagador"],
  ["nano", "pagador"],
  ["dificil", "miedoso"],
  ["nano", "miedoso"],
  ["dificil", "maniaco"],
  ["nano", "maniaco"],
]
const t0 = Date.now()
console.log(`${GAME} ${DECK}, ${PLAYERS} jugadores, ${HANDS} manos por mesa, ${TRIALS} simulaciones, semilla ${SEED}`)
for (const [a, b] of pairs.filter(([a, b]) => !ONLY || a === ONLY || b === ONLY)) {
  const r = match(a, b, SEED + a.length * 31 + b.length)
  console.log(`${a.padEnd(8)} vs ${b.padEnd(8)}  ${a}: ${r.a >= 0 ? "+" : ""}${r.a.toFixed(1)} luz/100   ${b}: ${r.b >= 0 ? "+" : ""}${r.b.toFixed(1)} luz/100   [${((Date.now() - t0) / 1000).toFixed(0)}s]`)
}
