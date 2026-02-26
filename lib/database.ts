import { supabase, type Player, type MatchWithPlayers, type PlayerStats, type ActiveMatch, type Tournament } from "./supabase"

const POINTS_DISTRIBUTION = [10, 7, 5, 3, 2, 1, 0, 0]

export class DatabaseService {
  // Player operations
  static async getAllPlayers(): Promise<Player[]> {
    const { data, error } = await supabase.from("players").select("*").order("name")

    if (error) throw error
    return data || []
  }

  static async createPlayer(name: string): Promise<Player> {
    const { data, error } = await supabase.from("players").insert({ name }).select().single()

    if (error) throw error
    return data
  }

  static async getPlayerByName(name: string): Promise<Player | null> {
    const { data, error } = await supabase.from("players").select("*").eq("name", name).single()

    if (error && error.code !== "PGRST116") throw error
    return data
  }

  // Tournament operations
  static async getTournaments(): Promise<Tournament[]> {
    const { data, error } = await supabase
      .from("tournaments")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) throw error
    return data || []
  }

  static async createTournament(name: string): Promise<Tournament> {
    const { data, error } = await supabase
      .from("tournaments")
      .insert({ name })
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async closeTournament(id: string): Promise<void> {
    const { error } = await supabase
      .from("tournaments")
      .update({ closed_at: new Date().toISOString() })
      .eq("id", id)

    if (error) throw error
  }

  // Match operations
  static async getAllMatches(tournamentId: string): Promise<MatchWithPlayers[]> {
    const { data, error } = await supabase
      .from("matches")
      .select(`
        *,
        match_players (
          *,
          players (*)
        )
      `)
      .eq("tournament_id", tournamentId)
      .order("date", { ascending: false })

    if (error) throw error
    return data || []
  }

  static async createMatch(matchData: {
    date: string
    cajiValue: number
    tournamentId: string
    players: Array<{
      name: string
      cajitas: number
      finalChips: number
      moneyWon: number
    }>
  }): Promise<MatchWithPlayers> {
    // Sort players by money won (descending), then by cajitas (ascending) for tie-breaking
    const sortedPlayers = [...matchData.players]
      .map((player, index) => ({ ...player, originalIndex: index, tieBreak: (player as any).tieBreak ?? Math.random() }))
      .sort((a, b) => {
        // First sort by money won (descending)
        if (b.moneyWon !== a.moneyWon) {
          return b.moneyWon - a.moneyWon
        }
        // If tied, sort by cajitas (ascending - fewer cajitas = better position)
        if (a.cajitas !== b.cajitas) {
          return a.cajitas - b.cajitas
        }
        // If still tied, use stable tie-breaker value
        return a.tieBreak! - b.tieBreak!
      })

    const totalMoney = matchData.players.reduce((sum, p) => sum + p.cajitas * matchData.cajiValue, 0)

    // Create the match
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .insert({
        date: matchData.date,
        caji_value: matchData.cajiValue,
        total_money: totalMoney,
        player_count: matchData.players.length,
        tournament_id: matchData.tournamentId,
      })
      .select()
      .single()

    if (matchError) throw matchError

    // Create or get players and create match_players records
    const matchPlayerPromises = sortedPlayers.map(async (player, position) => {
      // Try to get existing player or create new one
      let dbPlayer = await this.getPlayerByName(player.name)
      if (!dbPlayer) {
        dbPlayer = await this.createPlayer(player.name)
      }

      const points = POINTS_DISTRIBUTION[position] || 0

      const { data: matchPlayer, error: matchPlayerError } = await supabase
        .from("match_players")
        .insert({
          match_id: match.id,
          player_id: dbPlayer.id,
          cajitas: player.cajitas,
          final_chips: player.finalChips,
          money_won: player.moneyWon,
          position: position + 1,
          points,
        })
        .select(`
          *,
          players (*)
        `)
        .single()

      if (matchPlayerError) throw matchPlayerError
      return matchPlayer
    })

    const matchPlayers = await Promise.all(matchPlayerPromises)

    return {
      ...match,
      match_players: matchPlayers,
    }
  }

  static async deleteMatch(matchId: string): Promise<void> {
    const { error } = await supabase.from("matches").delete().eq("id", matchId)

    if (error) throw error
  }

  // Statistics operations
  static async getPlayerStats(tournamentId: string): Promise<PlayerStats[]> {
    const { data, error } = await supabase
      .from("match_players")
      .select(`
        player_id,
        points,
        cajitas,
        money_won,
        players (id, name),
        matches!inner (tournament_id)
      `)
      .eq("matches.tournament_id", tournamentId)

    if (error) throw error

    // Aggregate by player in JS
    const playerMap = new Map<string, PlayerStats>()

    for (const mp of data || []) {
      const player = mp.players as any
      if (!player) continue

      if (!playerMap.has(mp.player_id)) {
        playerMap.set(mp.player_id, {
          id: mp.player_id,
          name: player.name,
          points: 0,
          matches: 0,
          cajitas: 0,
          moneyWon: 0,
          averagePerMatch: 0,
        })
      }

      const stats = playerMap.get(mp.player_id)!
      stats.points += mp.points
      stats.cajitas += mp.cajitas
      stats.moneyWon += mp.money_won
      stats.matches += 1
    }

    return Array.from(playerMap.values())
      .map((s) => ({ ...s, averagePerMatch: s.matches > 0 ? s.moneyWon / s.matches : 0 }))
      .sort((a, b) => b.points - a.points)
  }

  static async getPlayerLastMatches(
    playerName: string,
    tournamentId: string,
    limit = 5,
  ): Promise<
    Array<{
      position: number
      moneyWon: number
      date: string
    }>
  > {
    const { data, error } = await supabase
      .from("match_players")
      .select(`
        position,
        money_won,
        matches!inner (date, tournament_id),
        players!inner (name)
      `)
      .eq("players.name", playerName)
      .eq("matches.tournament_id", tournamentId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) throw error

    return (data || []).map((mp) => ({
      position: mp.position,
      moneyWon: mp.money_won,
      date: (mp.matches as any)?.date || "",
    }))
  }

  static async getOverallStats(tournamentId: string) {
    const [matchesResult, playersResult] = await Promise.all([
      supabase
        .from("matches")
        .select("total_money, match_players(cajitas)")
        .eq("tournament_id", tournamentId),
      supabase.from("players").select("id"),
    ])

    if (matchesResult.error) throw matchesResult.error
    if (playersResult.error) throw playersResult.error

    const matches = matchesResult.data || []
    const totalMatches = matches.length
    const totalMoney = matches.reduce((sum, match) => sum + match.total_money, 0)
    const totalCajitas = matches.reduce(
      (sum, match) => sum + (match.match_players || []).reduce((cajiSum, mp) => cajiSum + mp.cajitas, 0),
      0,
    )
    const activePlayers = playersResult.data?.length || 0

    return {
      totalMatches,
      totalCajitas,
      totalMoney,
      activePlayers,
    }
  }

  // Fix existing matches ranking
  static async fixMatchRankings(): Promise<void> {
    // Get all matches with their players
    const { data: matches, error: matchesError } = await supabase.from("matches").select(`
        id,
        caji_value,
        match_players (
          id,
          cajitas,
          final_chips,
          money_won
        )
      `)

    if (matchesError) throw matchesError

    for (const match of matches || []) {
      // Sort players by money won (descending), then by cajitas (ascending)
      const sortedPlayers = [...match.match_players].sort((a, b) => {
        // First sort by money won (descending)
        if (b.money_won !== a.money_won) {
          return b.money_won - a.money_won
        }
        // If tied, sort by cajitas (ascending - fewer cajitas = better position)
        if (a.cajitas !== b.cajitas) {
          return a.cajitas - b.cajitas
        }
        // If still tied, random order (legacy fix); no deterministic tieBreak stored in historical data
        return Math.random() < 0.5 ? -1 : 1
      })

      // Update positions and points
      const updatePromises = sortedPlayers.map(async (player, index) => {
        const newPosition = index + 1
        const newPoints = POINTS_DISTRIBUTION[index] || 0

        const { error: updateError } = await supabase
          .from("match_players")
          .update({
            position: newPosition,
            points: newPoints,
          })
          .eq("id", player.id)

        if (updateError) throw updateError
      })

      await Promise.all(updatePromises)
    }
  }

  // Active Match operations
  static async getAllActiveMatches(tournamentId: string): Promise<ActiveMatch[]> {
    const { data, error } = await supabase
      .from("active_matches")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("❌ Error fetching active matches:", error)
      throw error
    }

    return data || []
  }

  static async getActiveMatchById(matchId: string): Promise<ActiveMatch | null> {
    const { data, error } = await supabase
      .from("active_matches")
      .select("*")
      .eq("id", matchId)
      .single()

    if (error) {
      console.error("❌ Error fetching active match by id:", error)
      return null
    }

    return data
  }

  static async createActiveMatch(matchData: {
    date: string
    cajiValue: number
    playerCount: number
    tournamentId: string
    players: Array<{
      name: string
      cajitas: number
      finalChips: number
      moneyWon: number
      tieBreak?: number
    }>
  }): Promise<ActiveMatch> {
    const playersWithTieBreak = matchData.players.map((p) => ({
      ...p,
      tieBreak: (p as any).tieBreak ?? Math.random(),
    }))

    const { data, error } = await supabase
      .from("active_matches")
      .insert({
        date: matchData.date,
        caji_value: matchData.cajiValue,
        player_count: matchData.playerCount,
        tournament_id: matchData.tournamentId,
        players: playersWithTieBreak,
      })
      .select()
      .single()

    if (error) {
      console.error("❌ Error creating active match:", error)
      throw error
    }

    return data
  }

  static async updateActiveMatch(
    matchId: string,
    matchData: {
      date: string
      cajiValue: number
      playerCount: number
      players: Array<{
        name: string
        cajitas: number
        finalChips: number
        moneyWon: number
        tieBreak?: number
      }>
    },
  ): Promise<ActiveMatch> {
    const playersWithTieBreak = matchData.players.map((p) => ({
      ...p,
      tieBreak: (p as any).tieBreak ?? Math.random(),
    }))

    const { data, error } = await supabase
      .from("active_matches")
      .update({
        date: matchData.date,
        caji_value: matchData.cajiValue,
        player_count: matchData.playerCount,
        players: playersWithTieBreak,
      })
      .eq("id", matchId)
      .select()
      .single()

    if (error) {
      console.error("❌ Error updating active match:", error)
      throw error
    }

    return data
  }

  static async deleteActiveMatch(matchId: string): Promise<void> {
    const { error } = await supabase.from("active_matches").delete().eq("id", matchId)

    if (error) {
      console.error("❌ Error deleting active match:", error)
      throw error
    }
  }

  static async registerActiveMatch(matchId: string): Promise<MatchWithPlayers> {
    // Get the active match
    const { data: activeMatch, error: fetchError } = await supabase
      .from("active_matches")
      .select("*")
      .eq("id", matchId)
      .single()

    if (fetchError) {
      console.error("❌ Error fetching active match for registration:", fetchError)
      throw fetchError
    }

    // Create the real match (preserving tournament_id)
    const realMatch = await this.createMatch({
      date: activeMatch.date,
      cajiValue: activeMatch.caji_value,
      tournamentId: activeMatch.tournament_id,
      players: activeMatch.players,
    })

    // Delete the active match
    await this.deleteActiveMatch(matchId)

    return realMatch
  }

  // Debug function to test database connection
  static async testConnection(): Promise<boolean> {
    try {
      const { error } = await supabase.from("active_matches").select("count", { count: "exact", head: true })

      if (error) {
        console.error("❌ Database connection test failed:", error)
        return false
      }

      return true
    } catch (err) {
      console.error("❌ Database connection test error:", err)
      return false
    }
  }

  // Función temporal para actualizar el sistema de puntos
  static async updatePointsSystem(): Promise<void> {
    console.log("🔄 Iniciando actualización del sistema de puntos...")

    try {
      const { data: matches, error: matchesError } = await supabase
        .from("matches")
        .select("id")
        .order("date")

      if (matchesError) throw matchesError

      for (const match of matches || []) {
        const { data: players, error: playersError } = await supabase
          .from("match_players")
          .select("*")
          .eq("match_id", match.id)
          .order("money_won", { ascending: false })
          .order("cajitas", { ascending: true })

        if (playersError) throw playersError

        for (let i = 0; i < (players || []).length; i++) {
          const player = players![i]
          const newPosition = i + 1
          const newPoints = POINTS_DISTRIBUTION[i] || 0

          const { error: updateError } = await supabase
            .from("match_players")
            .update({
              position: newPosition,
              points: newPoints
            })
            .eq("id", player.id)

          if (updateError) throw updateError
        }
      }

      console.log("✅ Actualización del sistema de puntos completada!")
    } catch (error) {
      console.error("❌ Error actualizando sistema de puntos:", error)
      throw error
    }
  }
}

export type { ActiveMatch, Tournament }
