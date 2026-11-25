// Laboratorio de La Cajita, estudio 4: ¿qué manos ganan cuando juegan más
// jugadores? (idea de las lecciones 64 y 311 de "Daily Dose of GTO", medida con
// nuestro motor para cada juego y mazo).
//
// Método: manos al azar. Para cada una, equity contra 1 rival al azar y contra
// 3 rivales al azar, hasta el river sin apuestas (todos ven las 5 cartas). Se
// compara con la "parte justa" (1/2 y 1/4): proporción = equity × jugadores.
// Más de 1 = gana más que su parte. Se agrupa por rasgos de la mano.
//
// Correr: npx tsx scripts/lab/multiway.ts [manos] [simulaciones] [semilla]

import { remainingDeck, seededRng, shuffle, type Card } from "../../lib/poker/cards"
import { equityVsRandom } from "../../lib/poker/preflop-beta"
import { GAMES, type Variant } from "../../lib/poker/variants"

const HANDS = Number(process.argv[2] ?? 1500)
const TRIALS = Number(process.argv[3] ?? 150)
const SEED = Number(process.argv[4] ?? 2026)

/** Rasgos (una mano puede tener varios). */
function tags(hand: readonly Card[]): string[] {
  const out: string[] = []
  const bySuit = [0, 0, 0, 0]
  const byRank = new Map<number, number>()
  for (const c of hand) {
    bySuit[c & 3]++
    const r = (c >> 2) + 2
    byRank.set(r, (byRank.get(r) ?? 0) + 1)
  }
  const pairs = [...byRank].filter(([, n]) => n >= 2).map(([r]) => r)
  const suitedGroups = bySuit.filter((n) => n >= 2).length
  const ranks = new Set(byRank.keys())
  if (ranks.has(14)) ranks.add(1)
  let run = 0
  let longest = 0
  for (let r = 1; r <= 14; r++) {
    run = ranks.has(r) ? run + 1 : 0
    longest = Math.max(longest, run)
  }
  const connectedAt = hand.length === 2 ? 2 : 3

  if (pairs.some((r) => r >= 10)) out.push("Par alto (10 a A)")
  if (pairs.some((r) => r < 10)) out.push("Par chico (hasta 9)")
  if (hand.length === 2) out.push(suitedGroups ? "Mismo palo" : "Distinto palo")
  else out.push(suitedGroups >= 2 ? "Dos palos" : suitedGroups === 1 ? "Un palo" : "Sin palo repetido")
  if (longest >= connectedAt) out.push(hand.length === 2 ? "Seguidas" : "3 o más seguidas")
  if (byRank.has(14)) out.push("Con As")
  if (!pairs.length && !suitedGroups && longest < connectedAt) out.push("Sin par, sin palo, sin seguidas")
  return out
}

interface Acc {
  n: number
  heads: number
  four: number
}

function study(v: Variant, rng: () => number) {
  const hole = GAMES[v.game].holeCount
  const byTag = new Map<string, Acc>()
  const all: Acc = { n: 0, heads: 0, four: 0 }
  for (let h = 0; h < HANDS; h++) {
    const hand = shuffle(remainingDeck(v.deck, []), rng).slice(0, hole)
    const heads = equityVsRandom(hand, v, TRIALS, rng, 1) * 2
    const four = equityVsRandom(hand, v, TRIALS, rng, 3) * 4
    for (const t of [...tags(hand), "Todas"]) {
      const a = t === "Todas" ? all : byTag.get(t) ?? { n: 0, heads: 0, four: 0 }
      a.n++
      a.heads += heads
      a.four += four
      if (t !== "Todas") byTag.set(t, a)
    }
  }
  return { byTag, all }
}

const rng = seededRng(SEED)
console.log(`\nManos por juego: ${HANDS} · simulaciones por mano y cantidad de rivales: ${TRIALS} · semilla ${SEED}`)
console.log("Proporción = equity × jugadores (1,00 = su parte justa). «Cambio» = 4 jugadores − 2 jugadores.\n")
for (const deck of ["long", "short"] as const)
  for (const game of ["holdem", "omaha", "manhattan"] as const) {
    const v: Variant = { game, deck }
    const t = Date.now()
    const { byTag } = study(v, rng)
    console.error(`${game} ${deck}: ${((Date.now() - t) / 1000).toFixed(1)}s`)
    console.log(`**${GAMES[game].name} ${deck === "long" ? "Long" : "Short"}**\n`)
    console.log("| Rasgo | Manos | Mano a mano | 4 jugadores | Cambio |")
    console.log("|---|---|---|---|---|")
    const rows = [...byTag].filter(([, a]) => a.n >= 30)
    rows.sort((a, b) => b[1].four / b[1].n - b[1].heads / b[1].n - (a[1].four / a[1].n - a[1].heads / a[1].n))
    for (const [tag, a] of rows) {
      const h2 = a.heads / a.n
      const h4 = a.four / a.n
      const d = h4 - h2
      console.log(`| ${tag} | ${a.n} | ${h2.toFixed(2)} | ${h4.toFixed(2)} | ${d >= 0 ? "+" : ""}${d.toFixed(2)} |`)
    }
    console.log("")
  }
