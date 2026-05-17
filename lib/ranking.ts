// Lógica pura de ordenamiento de jugadores dentro de una partida.
// Vive separada de database.ts para poder testearla sin DB.

export interface RankablePlayer {
  cajitas: number
  finalChips: number
  moneyWon: number
}

export interface RankedPlayer<P extends RankablePlayer> {
  player: P
  position: number
  tieBreak: number
}

/**
 * Ordena los jugadores de una partida y les asigna `position` (1..N) y un
 * `tieBreak` determinístico igual al índice de entrada original.
 *
 * Criterios, en orden:
 *  1) Mayor `moneyWon` gana.
 *  2) Menos `cajitas` (buy-ins) gana.
 *  3) El que aparece antes en el array de entrada gana — esto persiste como
 *     `tie_break` en `match_players` para que la posición sea reproducible.
 */
export function rankMatchPlayers<P extends RankablePlayer>(
  players: readonly P[],
): RankedPlayer<P>[] {
  return players
    .map((player, idx) => ({ player, tieBreak: idx }))
    .sort((a, b) => {
      if (b.player.moneyWon !== a.player.moneyWon) {
        return b.player.moneyWon - a.player.moneyWon
      }
      if (a.player.cajitas !== b.player.cajitas) {
        return a.player.cajitas - b.player.cajitas
      }
      return a.tieBreak - b.tieBreak
    })
    .map((entry, position) => ({
      player: entry.player,
      tieBreak: entry.tieBreak,
      position: position + 1,
    }))
}
