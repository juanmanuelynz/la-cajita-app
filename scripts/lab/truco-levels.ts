// Laboratorio de La Cajita Truco: ¿cada nivel de la máquina le gana al anterior?
//
// Método: partidas enteras a 30, mano a mano, entre dos jugadores (niveles de
// lib/truco/ai.ts o "azar", que hace cualquier jugada legal), con semilla fija.
// Cada par juega N partidas alternando quién es mano en la primera. Se mide el %
// de partidas que gana el primero, con su intervalo de 95%.
//
// Correr: npx tsx scripts/lab/truco-levels.ts [partidas] [semilla]

import { seededRng, type Rng } from "../../lib/poker/cards"
import { BOT_LEVELS, decide, type BotLevel } from "../../lib/truco/ai"
import { act, actor, dealHand, legal, newGame, type GameState, type Player, type TrucoAction } from "../../lib/truco/engine"

const GAMES = Number(process.argv[2] ?? 400)
const SEED = Number(process.argv[3] ?? 2026)

type Who = BotLevel | "azar"

function randomAction(g: GameState, p: Player, rng: Rng): TrucoAction {
  const l = legal(g, p)
  const opts: TrucoAction[] = []
  if (l.play) g.hand.cards[p].forEach((_, i) => opts.push({ type: "play", index: i }))
  if (l.quiero) opts.push({ type: "quiero" })
  if (l.noQuiero) opts.push({ type: "noQuiero" })
  if (l.truco) opts.push({ type: "truco" })
  for (const k of l.envido) opts.push({ type: "envido", call: k })
  return opts[Math.floor(rng() * opts.length)]
}

/** Partida a 30; devuelve el ganador (0 o 1). */
function playGame(a: Who, b: Who, mano: Player, rng: Rng): Player {
  const who: [Who, Who] = [a, b]
  let g = newGame({ target: 30, mano }, rng)
  let steps = 0
  while (!g.over) {
    if (g.hand.over) {
      g = dealHand(g, rng)
      continue
    }
    const p = actor(g)!
    const w = who[p]
    g = act(g, p, w === "azar" ? randomAction(g, p, rng) : decide(g, p, rng, w))
    if (++steps > 20000) throw new Error("partida sin fin")
  }
  return g.winner!
}

function match(a: Who, b: Who, seed: number) {
  const rng = seededRng(seed)
  let wins = 0
  for (let i = 0; i < GAMES; i++) if (playGame(a, b, (i % 2) as Player, rng) === 0) wins++
  const p = wins / GAMES
  const ci = 1.96 * Math.sqrt((p * (1 - p)) / GAMES)
  return { p, ci }
}

const pairs: [Who, Who][] = [
  ["media", "facil"],
  ["dificil", "media"],
  ["dificil", "facil"],
  ...BOT_LEVELS.map((l): [Who, Who] => [l, "azar"]),
]
console.log(`Partidas a 30, ${GAMES} por par, semilla ${SEED}`)
for (const [a, b] of pairs) {
  const t = Date.now()
  const { p, ci } = match(a, b, SEED)
  console.log(`${a.padEnd(8)} vs ${b.padEnd(8)}  gana ${(p * 100).toFixed(1)}% ± ${(ci * 100).toFixed(1)}  (${((Date.now() - t) / 1000).toFixed(0)} s)`)
}
