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

export function calculateROIPerPlayer(matches: MatchWithPlayers[]) {
  const playerData: { [name: string]: { totalInvestment: number; totalMoney: number } } = {}
  matches.forEach((match) => {
    match.match_players.forEach((mp) => {
      const name = mp.players.name
      if (!playerData[name]) playerData[name] = { totalInvestment: 0, totalMoney: 0 }
      playerData[name].totalInvestment += mp.cajitas * match.caji_value
      playerData[name].totalMoney += mp.money_won
    })
  })

  const roiData: { [name: string]: number } = {}
  Object.keys(playerData).forEach((name) => {
    const { totalInvestment, totalMoney } = playerData[name]
    roiData[name] = totalInvestment > 0 ? (totalMoney / totalInvestment) * 100 : 0
  })

  return Object.fromEntries(
    Object.entries(roiData)
      .filter(([_, roi]) => !isNaN(roi))
      .sort(([, a], [, b]) => b - a),
  )
}

export function formatROIForBarChart(matches: MatchWithPlayers[]) {
  const roiData = calculateROIPerPlayer(matches)
  const labels = Object.keys(roiData)
  const data = Object.values(roiData)
  const backgroundColor = data.map((roi) =>
    roi >= 0 ? "rgba(16, 185, 129, 0.8)" : "rgba(244, 63, 94, 0.8)",
  )
  const borderColor = data.map((roi) =>
    roi >= 0 ? "rgba(16, 185, 129, 1)" : "rgba(244, 63, 94, 1)",
  )
  return { labels, data, backgroundColor, borderColor }
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

export interface Comeback {
  jugador: string
  comeback_amount: number
  fecha: string
  partida_detalle: {
    dinero_inicial: number
    punto_mas_bajo: number
    dinero_final: number
    cajitas: number
    monto_invertido: number
  }
}

export function calculateTopComebacks(matches: MatchWithPlayers[]): Comeback[] {
  const comebacks: Comeback[] = []
  matches.forEach((match) => {
    match.match_players.forEach((mp) => {
      const inversionTotal = mp.cajitas * match.caji_value
      const dineroNeto = mp.money_won
      if (dineroNeto > 0) {
        comebacks.push({
          jugador: mp.players.name,
          comeback_amount: inversionTotal + dineroNeto,
          fecha: match.date,
          partida_detalle: {
            dinero_inicial: 0,
            punto_mas_bajo: -inversionTotal,
            dinero_final: dineroNeto,
            cajitas: mp.cajitas,
            monto_invertido: inversionTotal,
          },
        })
      }
    })
  })
  return comebacks.sort((a, b) => b.comeback_amount - a.comeback_amount).slice(0, 3)
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
