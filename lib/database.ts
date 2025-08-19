import { supabase, type Player, type MatchWithPlayers, type PlayerStats } from "./supabase"

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

  // Match operations
  static async getAllMatches(): Promise<MatchWithPlayers[]> {
    const { data, error } = await supabase
      .from("matches")
      .select(`
        *,
        match_players (
          *,
          players (*)
        )
      `)
      .order("date", { ascending: false })

    if (error) throw error
    return data || []
  }

  static async createMatch(matchData: {
    date: string
    cajiValue: number
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
  static async getPlayerStats(): Promise<PlayerStats[]> {
    const { data, error } = await supabase.from("players").select(`
        id,
        name,
        match_players (
          points,
          cajitas,
          money_won
        )
      `)

    if (error) throw error

    const playerStats: PlayerStats[] = (data || [])
      .map((player) => {
        const matches = player.match_players || []
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
      .sort((a, b) => b.points - a.points)

    return playerStats
  }

  static async getPlayerLastMatches(
    playerName: string,
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
        matches (date),
        players!inner (name)
      `)
      .eq("players.name", playerName)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) throw error

    return (data || []).map((mp) => ({
      position: mp.position,
      moneyWon: mp.money_won,
      date: (mp.matches as any)?.date || "",
    }))
  }

  static async getOverallStats() {
    const [matchesResult, playersResult] = await Promise.all([
      supabase.from("matches").select("total_money, match_players(cajitas)"),
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
  static async getAllActiveMatches(): Promise<ActiveMatch[]> {
    console.log("🔍 Fetching active matches from database...")

    const { data, error } = await supabase.from("active_matches").select("*").order("created_at", { ascending: false })

    if (error) {
      console.error("❌ Error fetching active matches:", error)
      throw error
    }

    console.log("✅ Active matches fetched:", data?.length || 0, "matches")
    console.log("📊 Active matches data:", data)

    return data || []
  }

  static async getActiveMatchById(matchId: string): Promise<ActiveMatch | null> {
    console.log("🔍 Fetching active match by id...", matchId)

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
    players: Array<{
      name: string
      cajitas: number
      finalChips: number
      moneyWon: number
      tieBreak?: number
    }>
  }): Promise<ActiveMatch> {
    console.log("🆕 Creating active match:", matchData)

    const playersWithTieBreak = matchData.players.map((p) => ({
      ...p,
      // ensure deterministic tie-break value is stored
      tieBreak: (p as any).tieBreak ?? Math.random(),
    }))

    const { data, error } = await supabase
      .from("active_matches")
      .insert({
        date: matchData.date,
        caji_value: matchData.cajiValue,
        player_count: matchData.playerCount,
        players: playersWithTieBreak,
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
      players: Array<{
        name: string
        cajitas: number
        finalChips: number
        moneyWon: number
        tieBreak?: number
      }>
    },
  ): Promise<ActiveMatch> {
    console.log("📝 Updating active match:", matchId, matchData)

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

  // Función temporal para actualizar el sistema de puntos
  static async updatePointsSystem(): Promise<void> {
    console.log("🔄 Iniciando actualización del sistema de puntos...")
    
    try {
      // Obtener todas las partidas
      const { data: matches, error: matchesError } = await supabase
        .from("matches")
        .select("id")
        .order("date")

      if (matchesError) throw matchesError

      for (const match of matches || []) {
        console.log(`🔄 Procesando partida: ${match.id}`)
        
        // Obtener jugadores de la partida ordenados por dinero ganado (desc) y cajitas (asc)
        const { data: players, error: playersError } = await supabase
          .from("match_players")
          .select("*")
          .eq("match_id", match.id)
          .order("money_won", { ascending: false })
          .order("cajitas", { ascending: true })

        if (playersError) throw playersError

        // Actualizar posición y puntos de cada jugador
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

export interface ActiveMatch {
  id: string
  date: string
  caji_value: number
  player_count: number
  players: Array<{
    name: string
    cajitas: number
    finalChips: number
    moneyWon: number
  }>
  created_at: string
  updated_at: string
}
