// Laboratorio de La Cajita, estudio 2: ¿qué flops salen más seguido en mazo
// largo y en mazo corto? (idea de la lección 127 de "Daily Dose of GTO":
// contar combinaciones). Es exacto: recorre todos los flops posibles. No
// depende del juego (Hold'em, Omaha y Manhattan usan la misma mesa).
//
// Correr: npx tsx scripts/lab/flop-textures.ts

import { makeDeck, rankOf, suitOf, type DeckType } from "../../lib/poker/cards"

/** Escaleras posibles según el mazo (en corto, A-6-7-8-9 es escalera: reglas de la casa). */
function straightWindows(deck: DeckType): number[][] {
  const low = deck === "short" ? 6 : 2
  const out: number[][] = [deck === "short" ? [14, 6, 7, 8, 9] : [14, 2, 3, 4, 5]]
  for (let r = low; r + 4 <= 14; r++) out.push([r, r + 1, r + 2, r + 3, r + 4])
  return out
}

const SUIT_NAMES = ["Tres palos distintos", "Dos del mismo palo", "Los tres del mismo palo"] as const
const PAIR_NAMES = ["Sin par", "Con par", "Trío"] as const

function study(deck: DeckType) {
  const cards = makeDeck(deck)
  const windows = straightWindows(deck)
  const grid = Array.from({ length: 3 }, () => [0, 0, 0])
  let total = 0
  let straightMade = 0
  for (let i = 0; i < cards.length; i++)
    for (let j = i + 1; j < cards.length; j++)
      for (let k = j + 1; k < cards.length; k++) {
        const f = [cards[i], cards[j], cards[k]]
        const suits = new Set(f.map(suitOf)).size
        const ranks = new Set(f.map(rankOf))
        const suitIdx = suits === 3 ? 0 : suits === 2 ? 1 : 2
        const pairIdx = ranks.size === 3 ? 0 : ranks.size === 2 ? 1 : 2
        grid[suitIdx][pairIdx]++
        total++
        // Sin par y los 3 rangos en una misma escalera: alguien puede tenerla ya.
        if (ranks.size === 3 && windows.some((w) => [...ranks].every((r) => w.includes(r)))) straightMade++
      }
  return { grid, total, straightMade }
}

const pct = (n: number, t: number) => `${((n / t) * 100).toFixed(1)}%`

console.log("\nTodos los flops posibles, contados uno por uno.\n")
const results = { long: study("long"), short: study("short") }
console.log("| Flop | Long (52 cartas) | Short (36 cartas) |")
console.log("|---|---|---|")
for (let s = 0; s < 3; s++)
  for (let p = 0; p < 3; p++) {
    if (s === 2 && p > 0) continue // tres del mismo palo no puede tener par
    const l = results.long.grid[s][p]
    const sh = results.short.grid[s][p]
    if (!l && !sh) continue
    console.log(`| ${SUIT_NAMES[s]} · ${PAIR_NAMES[p]} | ${pct(l, results.long.total)} | ${pct(sh, results.short.total)} |`)
  }
for (const [label, key] of [
  ["Total sin par", 0],
  ["Total con par", 1],
  ["Total trío", 2],
] as const) {
  const l = results.long.grid.reduce((a, row) => a + row[key], 0)
  const sh = results.short.grid.reduce((a, row) => a + row[key], 0)
  console.log(`| **${label}** | ${pct(l, results.long.total)} | ${pct(sh, results.short.total)} |`)
}
for (const [label, key] of [
  ["Total tres palos distintos", 0],
  ["Total dos del mismo palo", 1],
  ["Total tres del mismo palo", 2],
] as const) {
  const l = results.long.grid[key].reduce((a, x) => a + x, 0)
  const sh = results.short.grid[key].reduce((a, x) => a + x, 0)
  console.log(`| **${label}** | ${pct(l, results.long.total)} | ${pct(sh, results.short.total)} |`)
}
console.log(
  `| Sin par y los 3 rangos entran en una escalera (alguien puede tenerla ya) | ${pct(results.long.straightMade, results.long.total)} | ${pct(results.short.straightMade, results.short.total)} |`,
)
console.log(`\nFlops posibles: ${results.long.total} en Long, ${results.short.total} en Short.`)
