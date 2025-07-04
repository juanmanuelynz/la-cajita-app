import { supabase, type Player, type MatchWithPlayers, type PlayerStats, type Tournament } from "./supabase"

const POINTS_DISTRIBUTION = [25, 18, 15, 12, 10, 8, 6, 4]

export class DatabaseService {
  // Tournament operations
  static async getAllTournaments(): Promise<Tournament[]> {
    try {
      const { data, error } = await supabase.from("tournaments").select("*").order("year", { ascending: false })

      if (error) {
        // If table doesn't exist, return empty array
        if (error.code === "42P01" || error.message.includes("does not exist")) {
          console.log("⚠️ Tournaments table doesn't exist yet")
          return []
        }
        throw error
      }

      // Filter out tournaments that have no matches and are not the default tournament
      const tournamentsWithMatches = []
      for (const tournament of data || []) {
        const hasMatches = await this.tournamentHasMatches(tournament.id)
        // Keep tournament if it has matches OR if it's the default tournament
        if (hasMatches || tournament.name === "Poker y Faso 2025") {
          tournamentsWithMatches.push(tournament)
        } else {
          // Delete empty tournaments that are not the default
          console.log(`🗑️ Deleting empty tournament: ${tournament.name}`)
          await this.deleteEmptyTournament(tournament.id)
        }
      }

      return tournamentsWithMatches
    } catch (err) {
      console.log("⚠️ Error accessing tournaments table:", err)
      return []
    }
  }

  static async createTournament(name: string, year: number): Promise<Tournament> {
    const { data, error } = await supabase.from("tournaments").insert({ name, year }).select().single()

    if (error) throw error
    return data
  }

  static async getDefaultTournament(): Promise<Tournament | null> {
    try {
      const { data, error } = await supabase.from("tournaments").select("*").eq("name", "Poker y Faso 2025").single()

      if (error) {
        if (error.code === "PGRST116" || error.code === "42P01" || error.message.includes("does not exist")) {
          return null
        }
        throw error
      }
      return data
    } catch (err) {
      console.log("⚠️ Error accessing default tournament:", err)
      return null
    }
  }

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

  // Match operations
  static async getAllMatches(tournamentId?: string): Promise<MatchWithPlayers[]> {
    let query = supabase
      .from("matches")
      .select(`
        *,
        match_players (
          *,
          players (*)
        ),
        tournaments (*)
      `)
      .order("date", { ascending: false })

    if (tournamentId) {
      query = query.eq("tournament_id", tournamentId)
    }

    const { data, error } = await query

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
      .map((player, index) => ({ ...player, originalIndex: index }))
      .sort((a, b) => {
        // First sort by money won (descending)
        if (b.moneyWon !== a.moneyWon) {
          return b.moneyWon - a.moneyWon
        }
        // If tied, sort by cajitas (ascending - fewer cajitas = better position)
        return a.cajitas - b.cajitas
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
  static async getPlayerStats(tournamentId?: string): Promise<PlayerStats[]> {
    const query = supabase.from("players").select(`
        id,
        name,
        match_players (
          points,
          cajitas,
          money_won,
          matches!inner (
            tournament_id
          )
        )
      `)

    const { data, error } = await query

    if (error) throw error

    const playerStats: PlayerStats[] = (data || [])
      .map((player) => {
        // Filter matches by tournament if specified
        const matches = tournamentId
          ? player.match_players?.filter((mp) => mp.matches?.tournament_id === tournamentId) || []
          : player.match_players || []

        const totalPoints = matches.reduce((sum, mp) => sum + mp.points, 0)
        const totalCajitas = matches.reduce((sum, mp) => sum + mp.cajitas, 0)
        const totalMoneyWon = matches.reduce((sum, mp) => sum + mp.money_won, 0)
        const matchCount = matches.length

        return {
          id: player.id,
          name: player.name,
          points: totalPoints,
          matches: matchCount,
          cajitas: totalCajitas,
          moneyWon: totalMoneyWon,
          averagePerMatch: matchCount > 0 ? totalMoneyWon / matchCount : 0,
        }
      })
      .filter((player) => player.matches > 0) // Only include players with matches in this tournament
      .sort((a, b) => b.points - a.points)

    return playerStats
  }

  static async getPlayerLastMatches(
    playerName: string,
    limit = 5,
    tournamentId?: string,
  ): Promise<
    Array<{
      position: number
      moneyWon: number
      date: string
    }>
  > {
    let query = supabase
      .from("match_players")
      .select(`
        position,
        money_won,
        matches!inner (date, tournament_id),
        players!inner (name)
      `)
      .eq("players.name", playerName)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (tournamentId) {
      query = query.eq("matches.tournament_id", tournamentId)
    }

    const { data, error } = await query

    if (error) throw error

    return (data || []).map((mp) => ({
      position: mp.position,
      moneyWon: mp.money_won,
      date: mp.matches?.date || "",
    }))
  }

  static async getOverallStats(tournamentId?: string) {
    let matchesQuery = supabase.from("matches").select("total_money, match_players(cajitas)")
    const playersQuery = supabase.from("players").select("id")

    if (tournamentId) {
      matchesQuery = matchesQuery.eq("tournament_id", tournamentId)
    }

    const [matchesResult, playersResult] = await Promise.all([matchesQuery, playersQuery])

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
        return a.cajitas - b.cajitas
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
  static async getAllActiveMatches(tournamentId?: string): Promise<ActiveMatch[]> {
    console.log("🔍 Fetching active matches from database...")

    let query = supabase.from("active_matches").select("*").order("created_at", { ascending: false })

    if (tournamentId) {
      query = query.eq("tournament_id", tournamentId)
    }

    const { data, error } = await query

    if (error) {
      console.error("❌ Error fetching active matches:", error)
      throw error
    }

    console.log("✅ Active matches fetched:", data?.length || 0, "matches")
    console.log("📊 Active matches data:", data)

    return data || []
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
    }>
  }): Promise<ActiveMatch> {
    console.log("🆕 Creating active match:", matchData)

    const { data, error } = await supabase
      .from("active_matches")
      .insert({
        date: matchData.date,
        caji_value: matchData.cajiValue,
        player_count: matchData.playerCount,
        tournament_id: matchData.tournamentId || null, // Handle empty string
        players: matchData.players,
      })
      .select()
      .single()

    if (error) {
      console.error("❌ Error creating active match:", error)
      throw error
    }

    console.log("✅ Active match created:", data)
    return data
  }

  static async updateActiveMatch(
    matchId: string,
    matchData: {
      date: string
      cajiValue: number
      playerCount: number
      tournamentId: string
      players: Array<{
        name: string
        cajitas: number
        finalChips: number
        moneyWon: number
      }>
    },
  ): Promise<ActiveMatch> {
    console.log("📝 Updating active match:", matchId, matchData)

    const { data, error } = await supabase
      .from("active_matches")
      .update({
        date: matchData.date,
        caji_value: matchData.cajiValue,
        player_count: matchData.playerCount,
        tournament_id: matchData.tournamentId || null, // Handle empty string
        players: matchData.players,
      })
      .eq("id", matchId)
      .select()
      .single()

    if (error) {
      console.error("❌ Error updating active match:", error)
      throw error
    }

    console.log("✅ Active match updated:", data)
    return data
  }

  static async deleteActiveMatch(matchId: string): Promise<void> {
    console.log("🗑️ Deleting active match:", matchId)

    const { error } = await supabase.from("active_matches").delete().eq("id", matchId)

    if (error) {
      console.error("❌ Error deleting active match:", error)
      throw error
    }

    console.log("✅ Active match deleted")
  }

  static async registerActiveMatch(matchId: string): Promise<MatchWithPlayers> {
    console.log("📋 Registering active match:", matchId)

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

    console.log("📊 Active match to register:", activeMatch)

    // Create the real match
    const realMatch = await this.createMatch({
      date: activeMatch.date,
      cajiValue: activeMatch.caji_value,
      tournamentId: activeMatch.tournament_id,
      players: activeMatch.players,
    })

    // Delete the active match
    await this.deleteActiveMatch(matchId)

    console.log("✅ Active match registered successfully")
    return realMatch
  }

  // Debug function to test database connection
  static async testConnection(): Promise<boolean> {
    try {
      console.log("🔗 Testing database connection...")
      const { data, error } = await supabase.from("active_matches").select("count", { count: "exact", head: true })

      if (error) {
        console.error("❌ Database connection test failed:", error)
        return false
      }

      console.log("✅ Database connection successful. Active matches count:", data)
      return true
    } catch (err) {
      console.error("❌ Database connection test error:", err)
      return false
    }
  }

  // Add a method to delete empty tournaments
  static async deleteEmptyTournament(tournamentId: string): Promise<void> {
    const { error } = await supabase.from("tournaments").delete().eq("id", tournamentId)

    if (error) throw error
  }

  // Add a method to check if tournament has matches
  static async tournamentHasMatches(tournamentId: string): Promise<boolean> {
    const { data, error } = await supabase.from("matches").select("id").eq("tournament_id", tournamentId).limit(1)

    if (error) throw error
    return (data || []).length > 0
  }

  // Add method to delete tournament
  static async deleteTournament(tournamentId: string): Promise<void> {
    const { error } = await supabase.from("tournaments").delete().eq("id", tournamentId)

    if (error) throw error
  }
}

export interface ActiveMatch {
  id: string
  date: string
  caji_value: number
  player_count: number
  tournament_id: string | null
  players: Array<{
    name: string
    cajitas: number
    finalChips: number
    moneyWon: number
  }>
  created_at: string
  updated_at: string
}
