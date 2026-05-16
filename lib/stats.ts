import type { MatchWithPlayers, PlayerStats } from "./types"

export type SortBy = "points" | "money"

export function sortPlayerStats(playerStats: PlayerStats[], sortBy: SortBy): PlayerStats[] {
  return [...playerStats]
    .filter((p) => p.matches > 0)
    .sort((a, b) => {
      if (sortBy === "points") {
        if (b.points !== a.points) return b.points - a.points
        if (b.moneyWon !== a.moneyWon) return b.moneyWon - a.moneyWon
        return a.cajitas - b.cajitas
      }
      if (b.moneyWon !== a.moneyWon) return b.moneyWon - a.moneyWon
      if (b.points !== a.points) return b.points - a.points
      return a.cajitas - b.cajitas
    })
}

export function getPlayerBestMatch(matches: MatchWithPlayers[], playerName: string) {
  const playerMatches = matches.filter((m) =>
    m.match_players.some((mp) => mp.players?.name === playerName),
  )
  if (playerMatches.length === 0) return null

  let bestMatch = playerMatches[0]
  let bestMp = bestMatch.match_players.find((mp) => mp.players?.name === playerName)!
  for (const match of playerMatches) {
    const mp = match.match_players.find((mp) => mp.players?.name === playerName)!
    if (mp.money_won > bestMp.money_won) {
      bestMatch = match
      bestMp = mp
    }
  }
  return { date: bestMatch.date, position: bestMp.position, moneyWon: bestMp.money_won }
}

export function getPlayerWorstMatch(matches: MatchWithPlayers[], playerName: string) {
  const playerMatches = matches.filter((m) =>
    m.match_players.some((mp) => mp.players?.name === playerName),
  )
  if (playerMatches.length === 0) return null

  let worstMatch = playerMatches[0]
  let worstMp = worstMatch.match_players.find((mp) => mp.players?.name === playerName)!
  for (const match of playerMatches) {
    const mp = match.match_players.find((mp) => mp.players?.name === playerName)!
    if (mp.money_won < worstMp.money_won) {
      worstMatch = match
      worstMp = mp
    }
  }
  return { date: worstMatch.date, position: worstMp.position, moneyWon: worstMp.money_won }
}

export function getPlayerLastMatches(matches: MatchWithPlayers[], playerName: string) {
  return matches
    .filter((m) => m.match_players.some((mp) => mp.players?.name === playerName))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)
    .map((match) => {
      const mp = match.match_players.find((mp) => mp.players?.name === playerName)!
      return { position: mp.position, moneyWon: mp.money_won }
    })
}

export interface TopWinner {
  jugador: string
  victorias: number
  maxPot: number
  maxPotDate: string
  maxPotCajitas: number
}

export function getTopWinners(matches: MatchWithPlayers[]): TopWinner[] {
  const playerWins: {
    [name: string]: { wins: number; maxPot: number; maxPotDate: string; maxPotCajitas: number }
  } = {}

  matches.forEach((match) => {
    match.match_players.forEach((mp) => {
      const name = mp.players.name
      if (!playerWins[name]) {
        playerWins[name] = {
          wins: 0,
          maxPot: mp.money_won,
          maxPotDate: match.date,
          maxPotCajitas: mp.cajitas,
        }
      }
      if (mp.position === 1) playerWins[name].wins += 1
      if (mp.money_won > playerWins[name].maxPot) {
        playerWins[name].maxPot = mp.money_won
        playerWins[name].maxPotDate = match.date
        playerWins[name].maxPotCajitas = mp.cajitas
      }
    })
  })

  return Object.entries(playerWins)
    .map(([name, data]) => ({
      jugador: name,
      victorias: data.wins,
      maxPot: data.maxPot,
      maxPotDate: data.maxPotDate,
      maxPotCajitas: data.maxPotCajitas,
    }))
    .sort((a, b) => (b.victorias !== a.victorias ? b.victorias - a.victorias : b.maxPot - a.maxPot))
    .slice(0, 3)
}

export function getPositionEvolutionData(matches: MatchWithPlayers[], sortBy: SortBy = "money") {
  const dates = [...new Set(matches.map((m) => m.date))].sort()
  const playerCumulativeStats: {
    [name: string]: { [date: string]: { money: number; points: number } }
  } = {}

  dates.forEach((date) => {
    const matchesUpToDate = matches.filter((m) => m.date <= date)
    const statsAtDate: { [name: string]: { money: number; points: number } } = {}
    matchesUpToDate.forEach((match) => {
      match.match_players.forEach((mp) => {
        const name = mp.players.name
        if (!statsAtDate[name]) statsAtDate[name] = { money: 0, points: 0 }
        statsAtDate[name].money += mp.money_won
        statsAtDate[name].points += mp.points
      })
    })
    Object.entries(statsAtDate).forEach(([name, stats]) => {
      if (!playerCumulativeStats[name]) playerCumulativeStats[name] = {}
      playerCumulativeStats[name][date] = stats
    })
  })

  const evolutionData: { [name: string]: { date: string; position: number }[] } = {}
  dates.forEach((date) => {
    const playersAtDate = Object.entries(playerCumulativeStats)
      .filter(([_, stats]) => stats[date])
      .map(([name, stats]) => ({
        name,
        money: stats[date].money,
        points: stats[date].points,
      }))
      .sort((a, b) =>
        sortBy === "points"
          ? b.points - a.points || b.money - a.money
          : b.money - a.money || b.points - a.points,
      )

    playersAtDate.forEach((player, index) => {
      if (!evolutionData[player.name]) evolutionData[player.name] = []
      evolutionData[player.name].push({ date, position: index + 1 })
    })
  })

  return { dates, evolutionData }
}

export interface PlayerStreak {
  current: number
  currentType: "win" | "loss" | null
  bestWin: number
}

function longestRun(arr: number[], pred: (n: number) => boolean): number {
  let max = 0
  let cur = 0
  for (const x of arr) {
    if (pred(x)) {
      cur++
      if (cur > max) max = cur
    } else {
      cur = 0
    }
  }
  return max
}

export function getPlayerStreak(
  matches: MatchWithPlayers[],
  playerName: string,
): PlayerStreak {
  const results = matches
    .filter((m) => m.match_players.some((mp) => mp.players?.name === playerName))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((m) => m.match_players.find((mp) => mp.players?.name === playerName)!.money_won)

  const bestWin = longestRun(results, (x) => x > 0)
  if (results.length === 0) return { current: 0, currentType: null, bestWin }

  const last = results[results.length - 1]
  if (last === 0) return { current: 0, currentType: null, bestWin }

  const type: "win" | "loss" = last > 0 ? "win" : "loss"
  let current = 0
  for (let i = results.length - 1; i >= 0; i--) {
    const r = results[i]
    if ((type === "win" && r > 0) || (type === "loss" && r < 0)) current++
    else break
  }
  return { current, currentType: type, bestWin }
}

export interface Nemesis {
  name: string
  differential: number
  sharedMatches: number
}

export function getPlayerNemesis(
  matches: MatchWithPlayers[],
  playerName: string,
  minSharedMatches = 3,
): Nemesis | null {
  const byOpponent: Record<string, { diff: number; matches: number }> = {}

  for (const match of matches) {
    const me = match.match_players.find((mp) => mp.players?.name === playerName)
    if (!me) continue
    for (const mp of match.match_players) {
      const opp = mp.players?.name
      if (!opp || opp === playerName) continue
      if (!byOpponent[opp]) byOpponent[opp] = { diff: 0, matches: 0 }
      byOpponent[opp].diff += mp.money_won - me.money_won
      byOpponent[opp].matches += 1
    }
  }

  let worst: Nemesis | null = null
  for (const [name, { diff, matches: m }] of Object.entries(byOpponent)) {
    if (m < minSharedMatches || diff <= 0) continue
    if (!worst || diff > worst.differential) {
      worst = { name, differential: diff, sharedMatches: m }
    }
  }
  return worst
}

export type Cuadrante = "Genio" | "Apostador" | "Conservador" | "Temerario"

function getCuadrante(eficiencia: number, riesgo: number): Cuadrante {
  const eficienciaMediana = 0
  const riesgoMediano = 2
  if (eficiencia >= eficienciaMediana && riesgo < riesgoMediano) return "Genio"
  if (eficiencia >= eficienciaMediana && riesgo >= riesgoMediano) return "Apostador"
  if (eficiencia < eficienciaMediana && riesgo < riesgoMediano) return "Conservador"
  return "Temerario"
}

export interface EfficiencyEntry {
  jugador: string
  eficiencia_promedio: number
  cajitas_promedio: number
  cuadrante: Cuadrante
  partidas: number
  dinero_ganado_total: number
}

export function calculateEfficiencyAnalysis(matches: MatchWithPlayers[]): EfficiencyEntry[] {
  const playerAnalysis: {
    [name: string]: {
      inversion_total: number
      cajitas_total: number
      partidas: number
      dinero_ganado_total: number
    }
  } = {}

  matches.forEach((match) => {
    match.match_players.forEach((mp) => {
      const name = mp.players.name
      if (!playerAnalysis[name]) {
        playerAnalysis[name] = {
          inversion_total: 0,
          cajitas_total: 0,
          partidas: 0,
          dinero_ganado_total: 0,
        }
      }
      playerAnalysis[name].inversion_total += mp.cajitas * match.caji_value
      playerAnalysis[name].cajitas_total += mp.cajitas
      playerAnalysis[name].partidas += 1
      playerAnalysis[name].dinero_ganado_total += mp.money_won
    })
  })

  return Object.entries(playerAnalysis)
    .map(([jugador, data]) => {
      const eficiencia_total =
        data.inversion_total > 0 ? data.dinero_ganado_total / data.inversion_total : 0
      const cajitas_promedio = data.partidas > 0 ? data.cajitas_total / data.partidas : 0
      return {
        jugador,
        eficiencia_promedio: eficiencia_total,
        cajitas_promedio,
        cuadrante: getCuadrante(eficiencia_total, cajitas_promedio),
        partidas: data.partidas,
        dinero_ganado_total: data.dinero_ganado_total,
      }
    })
    .filter((p) => p.partidas > 0)
}

export function formatForQuadrantChart(matches: MatchWithPlayers[]) {
  const analysis = calculateEfficiencyAnalysis(matches)
  const cuadrantes: Array<{
    label: Cuadrante
    backgroundColor: string
    borderColor: string
  }> = [
    {
      label: "Genio",
      backgroundColor: "rgba(6, 182, 212, 0.8)",
      borderColor: "rgba(6, 182, 212, 1)",
    },
    {
      label: "Apostador",
      backgroundColor: "rgba(16, 185, 129, 0.8)",
      borderColor: "rgba(16, 185, 129, 1)",
    },
    {
      label: "Conservador",
      backgroundColor: "rgba(156, 163, 175, 0.8)",
      borderColor: "rgba(156, 163, 175, 1)",
    },
    {
      label: "Temerario",
      backgroundColor: "rgba(244, 63, 94, 0.8)",
      borderColor: "rgba(244, 63, 94, 1)",
    },
  ]

  return cuadrantes
    .map((c) => ({
      label: c.label,
      data: analysis
        .filter((p) => p.cuadrante === c.label)
        .map((p) => ({
          x: p.cajitas_promedio,
          y: p.eficiencia_promedio * 100,
          jugador: p.jugador,
        })),
      backgroundColor: c.backgroundColor,
      borderColor: c.borderColor,
    }))
    .filter((d) => d.data.length > 0)
}

export interface PartidaFlat {
  jugador: string
  dinero_ganado: number
  fecha: string
  cajitas: number
  rank?: number
}

export function flattenMatches(matches: MatchWithPlayers[]): PartidaFlat[] {
  return matches.flatMap((match) =>
    match.match_players.map((mp) => ({
      jugador: mp.players.name,
      dinero_ganado: mp.money_won,
      fecha: match.date,
      cajitas: mp.cajitas,
    })),
  )
}

export function getTopWins(matches: MatchWithPlayers[], limit = 3): PartidaFlat[] {
  return flattenMatches(matches)
    .filter((p) => p.dinero_ganado > 0)
    .sort((a, b) => b.dinero_ganado - a.dinero_ganado)
    .slice(0, limit)
    .map((p, i) => ({ ...p, rank: i + 1 }))
}

export function getTopLosses(matches: MatchWithPlayers[], limit = 3): PartidaFlat[] {
  return flattenMatches(matches)
    .filter((p) => p.dinero_ganado < 0)
    .sort((a, b) => a.dinero_ganado - b.dinero_ganado)
    .slice(0, limit)
    .map((p, i) => ({ ...p, rank: i + 1 }))
}

const DAY_NAMES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
]

function getDayOfWeek(dateStr: string): number {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    const [, y, m, d] = match
    return new Date(Number(y), Number(m) - 1, Number(d)).getDay()
  }
  return new Date(dateStr).getDay()
}

export interface FavoriteDay {
  dayName: string
  totalWon: number
  matchCount: number
}

export function getPlayerFavoriteDay(
  matches: MatchWithPlayers[],
  playerName: string,
  minMatches = 2,
): FavoriteDay | null {
  const byDay: Record<number, { won: number; count: number }> = {}
  for (const match of matches) {
    const mp = match.match_players.find((p) => p.players?.name === playerName)
    if (!mp) continue
    const dow = getDayOfWeek(match.date)
    if (!byDay[dow]) byDay[dow] = { won: 0, count: 0 }
    byDay[dow].won += mp.money_won
    byDay[dow].count += 1
  }

  let best: { day: number; won: number; count: number } | null = null
  for (const [day, v] of Object.entries(byDay)) {
    if (v.count < minMatches || v.won <= 0) continue
    if (!best || v.won > best.won) best = { day: Number(day), won: v.won, count: v.count }
  }
  if (!best) return null
  return { dayName: DAY_NAMES[best.day], totalWon: best.won, matchCount: best.count }
}

export interface KillerMove {
  date: string
  cajitas: number
  moneyWon: number
  investment: number
  roi: number
}

export function getPlayerKillerMove(
  matches: MatchWithPlayers[],
  playerName: string,
): KillerMove | null {
  let best: KillerMove | null = null
  for (const match of matches) {
    const mp = match.match_players.find((p) => p.players?.name === playerName)
    if (!mp || mp.money_won <= 0) continue
    const investment = mp.cajitas * match.caji_value
    if (investment <= 0) continue
    const roi = (mp.money_won / investment) * 100
    if (!best || roi > best.roi) {
      best = {
        date: match.date,
        cajitas: mp.cajitas,
        moneyWon: mp.money_won,
        investment,
        roi,
      }
    }
  }
  return best
}

export function getROIPerMatchData(matches: MatchWithPlayers[]) {
  const dates = [...new Set(matches.map((m) => m.date))].sort()
  const byPlayer: Record<string, { date: string; roi: number }[]> = {}

  for (const match of matches) {
    for (const mp of match.match_players) {
      const name = mp.players?.name
      if (!name) continue
      const investment = mp.cajitas * match.caji_value
      if (investment <= 0) continue
      const roi = (mp.money_won / investment) * 100
      if (!byPlayer[name]) byPlayer[name] = []
      byPlayer[name].push({ date: match.date, roi })
    }
  }

  for (const name of Object.keys(byPlayer)) {
    byPlayer[name].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    )
  }

  return { dates, byPlayer }
}
