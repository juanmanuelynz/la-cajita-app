// Lógica pura del "Resumen de la partida": podio, movimientos en el ranking
// del torneo y datos destacados. Vive separada de los componentes para poder
// testearla sin React ni DB.

import { sortPlayerStats, type SortBy } from "./stats"
import type { MatchWithPlayers, PlayerStats } from "./types"

export interface SummaryPlayer {
  playerId: string
  name: string
  position: number
  points: number
  moneyWon: number
  cajitas: number
}

export interface RankingMove {
  playerId: string
  name: string
  /** Posición en el ranking del torneo antes de la partida (null = no tenía partidas). */
  before: number | null
  /** Posición en el ranking del torneo después de la partida. */
  after: number
  /** Puestos ganados (positivo = subió). 0 si no tenía posición previa. */
  delta: number
  /** Valor acumulado que define el ranking (plata o puntos, según sortBy). */
  total: number
  playedThisMatch: boolean
}

export interface Highlight {
  emoji: string
  text: string
}

export interface MatchSummary {
  players: SummaryPlayer[]
  ranking: RankingMove[]
  highlights: Highlight[]
}

/** Orden cronológico de las partidas: fecha y, a igual fecha, hora de carga. */
export function sortMatchesChronologically(
  matches: readonly MatchWithPlayers[],
): MatchWithPlayers[] {
  return [...matches].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1
    return 0
  })
}

function aggregateStats(matches: readonly MatchWithPlayers[]): PlayerStats[] {
  const byId = new Map<string, PlayerStats>()
  for (const match of matches) {
    for (const mp of match.match_players) {
      const id = mp.player_id
      let s = byId.get(id)
      if (!s) {
        s = {
          id,
          name: mp.players?.name ?? "",
          points: 0,
          matches: 0,
          cajitas: 0,
          moneyWon: 0,
          averagePerMatch: 0,
        }
        byId.set(id, s)
      }
      s.points += Number(mp.points)
      s.moneyWon += Number(mp.money_won)
      s.cajitas += Number(mp.cajitas)
      s.matches += 1
    }
  }
  for (const s of byId.values()) {
    s.averagePerMatch = s.matches > 0 ? s.moneyWon / s.matches : 0
  }
  return [...byId.values()]
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ""
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`
}

/**
 * Arma el resumen de `match` dentro de su torneo. El ranking "antes" y
 * "después" se calcula solo con las partidas hasta esa (inclusive), así el
 * resumen de una partida vieja muestra lo que pasó en ese momento.
 */
export function buildMatchSummary(
  match: MatchWithPlayers,
  tournamentMatches: readonly MatchWithPlayers[],
  sortBy: SortBy,
  formatMoney: (n: number) => string = (n) => String(n),
): MatchSummary {
  const players: SummaryPlayer[] = [...match.match_players]
    .sort((a, b) => a.position - b.position)
    .map((mp) => ({
      playerId: mp.player_id,
      name: mp.players?.name ?? "",
      position: mp.position,
      points: Number(mp.points),
      moneyWon: Number(mp.money_won),
      cajitas: Number(mp.cajitas),
    }))

  const chronological = sortMatchesChronologically(
    tournamentMatches.some((m) => m.id === match.id)
      ? tournamentMatches
      : [...tournamentMatches, match],
  )
  const idx = chronological.findIndex((m) => m.id === match.id)
  const previous = chronological.slice(0, idx)
  const upToMatch = chronological.slice(0, idx + 1)

  const rankBefore = sortPlayerStats(aggregateStats(previous), sortBy)
  const rankAfter = sortPlayerStats(aggregateStats(upToMatch), sortBy)
  const beforePos = new Map(rankBefore.map((s, i) => [s.id, i + 1]))
  const inMatch = new Set(players.map((p) => p.playerId))

  const ranking: RankingMove[] = rankAfter.map((s, i) => {
    const before = beforePos.get(s.id) ?? null
    const after = i + 1
    return {
      playerId: s.id,
      name: s.name,
      before,
      after,
      delta: before === null ? 0 : before - after,
      total: sortBy === "points" ? s.points : s.moneyWon,
      playedThisMatch: inMatch.has(s.id),
    }
  })

  const highlights: Highlight[] = []
  const winner = players[0]
  const hasHistory = previous.length > 0

  if (winner && hasHistory) {
    // Racha: partidas consecutivas (de las que jugó el ganador) que terminó 1°.
    let streak = 0
    for (let i = upToMatch.length - 1; i >= 0; i--) {
      const mp = upToMatch[i].match_players.find((p) => p.player_id === winner.playerId)
      if (!mp) continue
      if (mp.position === 1) streak++
      else break
    }
    const previousWins = previous.filter((m) =>
      m.match_players.some((p) => p.player_id === winner.playerId && p.position === 1),
    ).length

    if (streak >= 2) {
      highlights.push({ emoji: "🔥", text: `${winner.name} ganó ${streak} partidas seguidas` })
    } else if (previousWins === 0) {
      highlights.push({ emoji: "🎉", text: `Primera victoria de ${winner.name} en el torneo` })
    }

    const previousBest = Math.max(
      ...previous.flatMap((m) => m.match_players.map((p) => Number(p.money_won))),
    )
    if (winner.moneyWon > 0 && winner.moneyWon > previousBest) {
      highlights.push({
        emoji: "💰",
        text: `Récord del torneo: ${winner.name} ganó $${formatMoney(winner.moneyWon)} en una noche`,
      })
    }
  }

  if (hasHistory && rankBefore[0] && rankAfter[0] && rankBefore[0].id !== rankAfter[0].id) {
    highlights.push({ emoji: "👑", text: `${rankAfter[0].name} es el nuevo líder del torneo` })
  }

  const climber = ranking
    .filter((r) => r.before !== null && r.delta >= 2)
    .sort((a, b) => b.delta - a.delta)[0]
  if (climber) {
    highlights.push({
      emoji: "📈",
      text: `${climber.name} subió ${climber.delta} puestos en el ranking`,
    })
  }

  const maxCajitas = Math.max(0, ...players.map((p) => p.cajitas))
  if (maxCajitas >= 3) {
    const buyers = players.filter((p) => p.cajitas === maxCajitas).map((p) => p.name)
    highlights.push({
      emoji: "📦",
      text: `${joinNames(buyers)} ${buyers.length > 1 ? "compraron" : "compró"} ${maxCajitas} cajitas`,
    })
  }

  return { players, ranking, highlights }
}
