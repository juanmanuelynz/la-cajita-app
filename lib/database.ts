"use server"

import { neon, types } from "@neondatabase/serverless"
import type {
  Player,
  MatchWithPlayers,
  PlayerStats,
  ActiveMatch,
  Tournament,
} from "./types"

// Devolver fechas/timestamps como string ISO (igual que Supabase via PostgREST),
// en lugar de objetos Date nativos — React no puede renderizar Date como child.
// OIDs: 1082 = DATE, 1114 = TIMESTAMP, 1184 = TIMESTAMPTZ.
types.setTypeParser(1082, (val) => val)
types.setTypeParser(1114, (val) => val)
types.setTypeParser(1184, (val) => val)

const sql = neon(process.env.DATABASE_URL!)

const POINTS_DISTRIBUTION = [10, 7, 5, 3, 2, 1, 0, 0]

// ────────────────────────────────────────────────────────────────────────────
// Players
// ────────────────────────────────────────────────────────────────────────────

export async function getAllPlayers(): Promise<Player[]> {
  const rows = await sql`SELECT id, name, created_at FROM players ORDER BY name`
  return rows as Player[]
}

export async function createPlayer(name: string): Promise<Player> {
  const rows = await sql`
    INSERT INTO players (name) VALUES (${name})
    RETURNING id, name, created_at
  `
  return rows[0] as Player
}

export async function getPlayerByName(name: string): Promise<Player | null> {
  const rows = await sql`
    SELECT id, name, created_at FROM players WHERE name = ${name} LIMIT 1
  `
  return (rows[0] as Player) ?? null
}

// ────────────────────────────────────────────────────────────────────────────
// Tournaments
// ────────────────────────────────────────────────────────────────────────────

export async function getTournaments(): Promise<Tournament[]> {
  const rows = await sql`
    SELECT * FROM tournaments ORDER BY created_at DESC
  `
  return rows as Tournament[]
}

export async function createTournament(name: string): Promise<Tournament> {
  const rows = await sql`
    INSERT INTO tournaments (name) VALUES (${name}) RETURNING *
  `
  return rows[0] as Tournament
}

export async function closeTournament(id: string): Promise<void> {
  await sql`UPDATE tournaments SET closed_at = NOW() WHERE id = ${id}`
}

// ────────────────────────────────────────────────────────────────────────────
// Matches
// ────────────────────────────────────────────────────────────────────────────

export async function getAllMatches(tournamentId: string): Promise<MatchWithPlayers[]> {
  const rows = await sql`
    SELECT
      m.id,
      m.date,
      m.caji_value,
      m.total_money,
      m.player_count,
      m.created_at,
      COALESCE(
        json_agg(
          json_build_object(
            'id', mp.id,
            'match_id', mp.match_id,
            'player_id', mp.player_id,
            'cajitas', mp.cajitas,
            'final_chips', mp.final_chips,
            'money_won', mp.money_won,
            'position', mp.position,
            'points', mp.points,
            'created_at', mp.created_at,
            'players', json_build_object('id', p.id, 'name', p.name, 'created_at', p.created_at)
          )
          ORDER BY mp.position ASC
        ) FILTER (WHERE mp.id IS NOT NULL),
        '[]'::json
      ) AS match_players
    FROM matches m
    LEFT JOIN match_players mp ON mp.match_id = m.id
    LEFT JOIN players p ON p.id = mp.player_id
    WHERE m.tournament_id = ${tournamentId}
    GROUP BY m.id
    ORDER BY m.date DESC
  `
  return rows as MatchWithPlayers[]
}

export async function createMatch(matchData: {
  date: string
  cajiValue: number
  tournamentId: string
  players: Array<{
    name: string
    cajitas: number
    finalChips: number
    moneyWon: number
    tieBreak?: number
  }>
}): Promise<MatchWithPlayers> {
  const sortedPlayers = [...matchData.players]
    .map((player, index) => ({
      ...player,
      originalIndex: index,
      tieBreak: player.tieBreak ?? Math.random(),
    }))
    .sort((a, b) => {
      if (b.moneyWon !== a.moneyWon) return b.moneyWon - a.moneyWon
      if (a.cajitas !== b.cajitas) return a.cajitas - b.cajitas
      return a.tieBreak - b.tieBreak
    })

  const totalMoney = matchData.players.reduce(
    (sum, p) => sum + p.cajitas * matchData.cajiValue,
    0,
  )

  const [match] = await sql`
    INSERT INTO matches (date, caji_value, total_money, player_count, tournament_id)
    VALUES (
      ${matchData.date},
      ${matchData.cajiValue},
      ${totalMoney},
      ${matchData.players.length},
      ${matchData.tournamentId}
    )
    RETURNING *
  `

  const matchPlayers = []
  for (let position = 0; position < sortedPlayers.length; position++) {
    const player = sortedPlayers[position]
    let dbPlayer = await getPlayerByName(player.name)
    if (!dbPlayer) dbPlayer = await createPlayer(player.name)

    const points = POINTS_DISTRIBUTION[position] || 0

    const [mp] = await sql`
      INSERT INTO match_players
        (match_id, player_id, cajitas, final_chips, money_won, position, points)
      VALUES (
        ${match.id},
        ${dbPlayer.id},
        ${player.cajitas},
        ${player.finalChips},
        ${player.moneyWon},
        ${position + 1},
        ${points}
      )
      RETURNING *
    `
    matchPlayers.push({ ...mp, players: dbPlayer })
  }

  return { ...match, match_players: matchPlayers } as MatchWithPlayers
}

export async function deleteMatch(matchId: string): Promise<void> {
  await sql`DELETE FROM matches WHERE id = ${matchId}`
}

// ────────────────────────────────────────────────────────────────────────────
// Statistics
// ────────────────────────────────────────────────────────────────────────────

export async function getPlayerStats(tournamentId: string): Promise<PlayerStats[]> {
  const rows = await sql`
    SELECT
      p.id,
      p.name,
      COALESCE(SUM(mp.points), 0)::int    AS points,
      COUNT(mp.id)::int                   AS matches,
      COALESCE(SUM(mp.cajitas), 0)::int   AS cajitas,
      COALESCE(SUM(mp.money_won), 0)::int AS money_won
    FROM match_players mp
    JOIN players p ON p.id = mp.player_id
    JOIN matches m ON m.id = mp.match_id
    WHERE m.tournament_id = ${tournamentId}
    GROUP BY p.id, p.name
    ORDER BY points DESC
  `
  return rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    points: Number(r.points) || 0,
    matches: Number(r.matches) || 0,
    cajitas: Number(r.cajitas) || 0,
    moneyWon: Number(r.money_won) || 0,
    averagePerMatch:
      Number(r.matches) > 0 ? Number(r.money_won) / Number(r.matches) : 0,
  }))
}

export async function getPlayerLastMatches(
  playerName: string,
  tournamentId: string,
  limit = 5,
): Promise<Array<{ position: number; moneyWon: number; date: string }>> {
  const rows = await sql`
    SELECT mp.position, mp.money_won, m.date
    FROM match_players mp
    JOIN matches m ON m.id = mp.match_id
    JOIN players p ON p.id = mp.player_id
    WHERE p.name = ${playerName} AND m.tournament_id = ${tournamentId}
    ORDER BY mp.created_at DESC
    LIMIT ${limit}
  `
  return rows.map((r: any) => ({
    position: r.position,
    moneyWon: r.money_won,
    date: typeof r.date === "string" ? r.date : r.date?.toISOString?.() ?? "",
  }))
}

export async function getOverallStats(tournamentId: string) {
  const [matchesResult, playersResult] = await Promise.all([
    sql`
      SELECT
        COUNT(DISTINCT m.id)::int               AS total_matches,
        COALESCE(SUM(DISTINCT m.total_money), 0)::int AS total_money,
        COALESCE(SUM(mp.cajitas), 0)::int       AS total_cajitas
      FROM matches m
      LEFT JOIN match_players mp ON mp.match_id = m.id
      WHERE m.tournament_id = ${tournamentId}
    `,
    sql`SELECT COUNT(*)::int AS count FROM players`,
  ])

  return {
    totalMatches: Number(matchesResult[0].total_matches) || 0,
    totalCajitas: Number(matchesResult[0].total_cajitas) || 0,
    totalMoney: Number(matchesResult[0].total_money) || 0,
    activePlayers: Number(playersResult[0].count) || 0,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Legacy fixers (kept for parity with prior DatabaseService)
// ────────────────────────────────────────────────────────────────────────────

export async function fixMatchRankings(): Promise<void> {
  const matches = await sql`
    SELECT m.id, m.caji_value,
      COALESCE(
        json_agg(
          json_build_object(
            'id', mp.id,
            'cajitas', mp.cajitas,
            'final_chips', mp.final_chips,
            'money_won', mp.money_won
          )
        ) FILTER (WHERE mp.id IS NOT NULL),
        '[]'::json
      ) AS match_players
    FROM matches m
    LEFT JOIN match_players mp ON mp.match_id = m.id
    GROUP BY m.id
  `

  for (const match of matches as any[]) {
    const sortedPlayers = [...(match.match_players ?? [])].sort((a, b) => {
      if (b.money_won !== a.money_won) return b.money_won - a.money_won
      if (a.cajitas !== b.cajitas) return a.cajitas - b.cajitas
      return Math.random() < 0.5 ? -1 : 1
    })

    for (let i = 0; i < sortedPlayers.length; i++) {
      const newPosition = i + 1
      const newPoints = POINTS_DISTRIBUTION[i] || 0
      await sql`
        UPDATE match_players
        SET position = ${newPosition}, points = ${newPoints}
        WHERE id = ${sortedPlayers[i].id}
      `
    }
  }
}

export async function updatePointsSystem(): Promise<void> {
  console.log("🔄 Iniciando actualización del sistema de puntos...")
  try {
    const matches = await sql`SELECT id FROM matches ORDER BY date`

    for (const match of matches as any[]) {
      const players = await sql`
        SELECT * FROM match_players
        WHERE match_id = ${match.id}
        ORDER BY money_won DESC, cajitas ASC
      `

      for (let i = 0; i < players.length; i++) {
        const player = players[i] as any
        const newPosition = i + 1
        const newPoints = POINTS_DISTRIBUTION[i] || 0
        await sql`
          UPDATE match_players
          SET position = ${newPosition}, points = ${newPoints}
          WHERE id = ${player.id}
        `
      }
    }
    console.log("✅ Actualización del sistema de puntos completada!")
  } catch (error) {
    console.error("❌ Error actualizando sistema de puntos:", error)
    throw error
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Active matches
// ────────────────────────────────────────────────────────────────────────────

export async function getAllActiveMatches(tournamentId: string): Promise<ActiveMatch[]> {
  const rows = await sql`
    SELECT * FROM active_matches
    WHERE tournament_id = ${tournamentId}
    ORDER BY created_at DESC
  `
  return rows as ActiveMatch[]
}

export async function getActiveMatchById(matchId: string): Promise<ActiveMatch | null> {
  const rows = await sql`
    SELECT * FROM active_matches WHERE id = ${matchId} LIMIT 1
  `
  return (rows[0] as ActiveMatch) ?? null
}

export async function createActiveMatch(matchData: {
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
    tieBreak: p.tieBreak ?? Math.random(),
  }))

  const rows = await sql`
    INSERT INTO active_matches
      (date, caji_value, player_count, tournament_id, players)
    VALUES (
      ${matchData.date},
      ${matchData.cajiValue},
      ${matchData.playerCount},
      ${matchData.tournamentId},
      ${JSON.stringify(playersWithTieBreak)}::jsonb
    )
    RETURNING *
  `
  return rows[0] as ActiveMatch
}

export async function updateActiveMatch(
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
    tieBreak: p.tieBreak ?? Math.random(),
  }))

  const rows = await sql`
    UPDATE active_matches
    SET date = ${matchData.date},
        caji_value = ${matchData.cajiValue},
        player_count = ${matchData.playerCount},
        players = ${JSON.stringify(playersWithTieBreak)}::jsonb,
        updated_at = NOW()
    WHERE id = ${matchId}
    RETURNING *
  `
  return rows[0] as ActiveMatch
}

export async function deleteActiveMatch(matchId: string): Promise<void> {
  await sql`DELETE FROM active_matches WHERE id = ${matchId}`
}

export async function registerActiveMatch(matchId: string): Promise<MatchWithPlayers> {
  const rows = await sql`SELECT * FROM active_matches WHERE id = ${matchId} LIMIT 1`
  const activeMatch = rows[0] as ActiveMatch | undefined
  if (!activeMatch) throw new Error(`Active match ${matchId} not found`)

  const realMatch = await createMatch({
    date: activeMatch.date,
    cajiValue: activeMatch.caji_value,
    tournamentId: activeMatch.tournament_id,
    players: activeMatch.players,
  })

  await deleteActiveMatch(matchId)
  return realMatch
}

// ────────────────────────────────────────────────────────────────────────────
// Diagnostics
// ────────────────────────────────────────────────────────────────────────────

export async function testConnection(): Promise<boolean> {
  try {
    await sql`SELECT 1`
    return true
  } catch (err) {
    console.error("❌ Database connection test error:", err)
    return false
  }
}
