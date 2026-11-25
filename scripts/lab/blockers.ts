// Laboratorio de La Cajita, estudio 3: ¿cuánto pesan los bloqueadores en cada
// juego? (idea de las lecciones 21, 24 y 89–91 de "Daily Dose of GTO"; los
// números son nuestros). Exacto, por combinatoria.
//
// Situación: estás en el river contra 1 rival. Se mira la chance de que el
// rival tenga una mano, según cuántas cartas clave tenés vos:
//   - Color: hay exactamente 3 cartas de un palo en la mesa. El rival hace color
//     con 2 o más de ese palo en la mano (vale en los 3 juegos: Omaha usa 2
//     sí o sí, Manhattan 2 con 3 de la mesa, Hold'em 2 con 3 de la mesa).
//   - Color máximo: tiene el As de ese palo y otra de ese palo (el As no está en la mesa).
//   - Trío: hay un K en la mesa (sin par). El rival tiene trío con 2 K en la mano.
// Tus otras cartas se suponen sin relación (ni del palo ni K).
//
// Correr: npx tsx scripts/lab/blockers.ts

import { deckSize, type DeckType } from "../../lib/poker/cards"
import { GAMES, type GameId } from "../../lib/poker/variants"

function binom(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let r = 1
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1)
  return r
}

/** Chance de tener al menos `need` de las `good` cartas buenas entre `draw` sacadas de `pool`. */
function atLeast(pool: number, good: number, draw: number, need: number): number {
  let p = 0
  for (let k = need; k <= Math.min(good, draw); k++) p += (binom(good, k) * binom(pool - good, draw - k)) / binom(pool, draw)
  return p
}

/** Chance de tener una carta concreta y al menos `more` de otras `good` (sin contarla). */
function withCard(pool: number, good: number, draw: number, more: number): number {
  // Fijo la carta: quedan draw-1 de pool-1, con `good` buenas.
  return (draw / pool) * atLeast(pool - 1, good, draw - 1, more)
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`

console.log("\nRiver, 1 rival. «Sin» = no tenés ninguna carta clave; «Con» = tenés una.\n")
console.log("| Juego | Mazo | Color: sin → con 1 del palo | Baja | Color con As: sin → con el As | Trío de K: sin → con 1 K | Baja |")
console.log("|---|---|---|---|---|---|---|")
for (const deck of ["long", "short"] as DeckType[])
  for (const game of ["holdem", "omaha", "manhattan"] as GameId[]) {
    const hole = GAMES[game].holeCount
    const suit = deck === "short" ? 9 : 13
    // Cartas que no ves: el mazo menos las 5 de la mesa y las tuyas.
    const pool = deckSize(deck) - 5 - hole
    // Color: quedan suit-3 del palo (menos las tuyas).
    const flushNo = atLeast(pool, suit - 3, hole, 2)
    const flushYes = atLeast(pool, suit - 4, hole, 2)
    // Color con As: el As no está en la mesa; sin bloqueo puede tenerlo.
    const nutNo = withCard(pool, suit - 4, hole, 1)
    // Trío de K: quedan 3 K (o 2 si tenés uno).
    const setNo = atLeast(pool, 3, hole, 2)
    const setYes = atLeast(pool, 2, hole, 2)
    console.log(
      `| ${GAMES[game].name} | ${deck === "long" ? "Long" : "Short"} | ${pct(flushNo)} → ${pct(flushYes)} | ${pct(1 - flushYes / flushNo)} | ${pct(nutNo)} → 0% | ${pct(setNo)} → ${pct(setYes)} | ${pct(1 - setYes / setNo)} |`,
    )
  }
