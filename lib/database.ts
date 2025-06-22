import { supabase, type Player, type MatchWithPlayers, type PlayerStats } from "./supabase"

const POINTS_DISTRIBUTION = [25, 18, 15, 12, 10, 8, 6, 4]

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
    // Sort players by final chips (descending) to determine positions
    const sortedPlayers = [...matchData.players]
      .map((player, index) => ({ ...player, originalIndex: index }))
      .sort((a, b) => b.finalChips - a.finalChips)

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
      date: mp.matches?.date || "",
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
}
