"use server"

import { neon, types } from "@neondatabase/serverless"
import { randomUUID } from "node:crypto"
import type {
  Player,
  MatchWithPlayers,
  PlayerStats,
  ActiveMatch,
  Tournament,
} from "./types"
import {
  CreateActiveMatchSchema,
  CreateMatchSchema,
  PlayerNameSchema,
  PointsConfigSchema,
  TournamentNameSchema,
  UpdateActiveMatchSchema,
  UuidSchema,
} from "./validators"

// Devolver fechas/timestamps como string ISO (igual que Supabase via PostgREST),
// en lugar de objetos Date nativos — React no puede renderizar Date como child.
// OIDs: 1082 = DATE, 1114 = TIMESTAMP, 1184 = TIMESTAMPTZ.
types.setTypeParser(1082, (val) => val)
types.setTypeParser(1114, (val) => val)
types.setTypeParser(1184, (val) => val)

const sql = neon(process.env.DATABASE_URL!)

const DEFAULT_POINTS_DISTRIBUTION = [10, 7, 5, 3, 2, 1, 0, 0]

// ────────────────────────────────────────────────────────────────────────────
// Players
// ────────────────────────────────────────────────────────────────────────────

export async function getAllPlayers(): Promise<Player[]> {
  const rows = await sql`SELECT id, name, created_at FROM players ORDER BY name`
  return rows as Player[]
}

export async function createPlayer(name: string): Promise<Player> {
  const parsed = PlayerNameSchema.parse(name)
  const rows = await sql`
    INSERT INTO players (name) VALUES (${parsed})
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id, name, created_at
  `
  return rows[0] as Player
}

export async function getPlayerByName(name: string): Promise<Player | null> {
  const parsed = PlayerNameSchema.parse(name)
  const rows = await sql`
    SELECT id, name, created_at FROM players WHERE name = ${parsed} LIMIT 1
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

export async function getTournamentById(id: string): Promise<Tournament | null> {
  const parsed = UuidSchema.parse(id)
  const rows = await sql`SELECT * FROM tournaments WHERE id = ${parsed} LIMIT 1`
  return (rows[0] as Tournament) ?? null
}

export async function createTournament(
  name: string,
  pointsConfig?: number[],
): Promise<Tournament> {
  const parsedName = TournamentNameSchema.parse(name)
  const parsedConfig = PointsConfigSchema.parse(
    pointsConfig ?? DEFAULT_POINTS_DISTRIBUTION,
  )
  const rows = await sql`
    INSERT INTO tournaments (name, points_config)
    VALUES (${parsedName}, ${JSON.stringify(parsedConfig)}::jsonb)
    RETURNING *
  `
  return rows[0] as Tournament
}

export async function closeTournament(id: string): Promise<void> {
  const parsed = UuidSchema.parse(id)
  await sql`UPDATE tournaments SET closed_at = NOW() WHERE id = ${parsed}`
}

// ────────────────────────────────────────────────────────────────────────────
// Matches
// ────────────────────────────────────────────────────────────────────────────

export async function getAllMatches(tournamentId: string): Promise<MatchWithPlayers[]> {
  const parsed = UuidSchema.parse(tournamentId)
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
            'tie_break', mp.tie_break,
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
    WHERE m.tournament_id = ${parsed}
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
  const validated = CreateMatchSchema.parse(matchData)

  // Cada torneo trae su propia distribución de puntos.
  const [tournamentRow] = (await sql`
    SELECT points_config FROM tournaments WHERE id = ${validated.tournamentId} LIMIT 1
  `) as Array<{ points_config: unknown }>
  if (!tournamentRow) {
    throw new Error(`Torneo ${validated.tournamentId} no encontrado`)
  }
  const pointsConfig = PointsConfigSchema.parse(
    Array.isArray(tournamentRow.points_config)
      ? tournamentRow.points_config
      : DEFAULT_POINTS_DISTRIBUTION,
  )

  // Orden final por dinero ganado → menos cajitas → tieBreak persistido.
  // Asignar tieBreak determinístico a quienes no lo trajeron (jugada nueva).
  const sortedPlayers = [...validated.players]
    .map((player) => ({
      ...player,
      tieBreak: player.tieBreak ?? Math.random(),
    }))
    .sort((a, b) => {
      if (b.moneyWon !== a.moneyWon) return b.moneyWon - a.moneyWon
      if (a.cajitas !== b.cajitas) return a.cajitas - b.cajitas
      return a.tieBreak - b.tieBreak
    })

  // Resolver player_id para cada nombre — upsert idempotente gracias al
  // UNIQUE en players.name. Estos INSERTs son seguros aún si la transacción
  // posterior falla: simplemente quedan jugadores creados sin partida.
  const resolvedPlayers = await Promise.all(
    sortedPlayers.map(async (p) => {
      const [row] = await sql`
        INSERT INTO players (name) VALUES (${p.name})
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id, name, created_at
      `
      return { ...p, dbPlayer: row as Player }
    }),
  )

  const totalMoney = validated.players.reduce(
    (sum, p) => sum + p.cajitas * validated.cajiValue,
    0,
  )

  // UUID generado en cliente para poder referenciarlo dentro de la transacción.
  const matchId = randomUUID()

  const matchInsert = sql`
    INSERT INTO matches (id, date, caji_value, total_money, player_count, tournament_id)
    VALUES (
      ${matchId},
      ${validated.date},
      ${validated.cajiValue},
      ${totalMoney},
      ${validated.players.length},
      ${validated.tournamentId}
    )
    RETURNING *
  `

  const mpInserts = resolvedPlayers.map((p, position) => {
    const points = pointsConfig[position] ?? 0
    return sql`
      INSERT INTO match_players
        (match_id, player_id, cajitas, final_chips, money_won, position, points, tie_break)
      VALUES (
        ${matchId},
        ${p.dbPlayer.id},
        ${p.cajitas},
        ${p.finalChips},
        ${p.moneyWon},
        ${position + 1},
        ${points},
        ${p.tieBreak}
      )
      RETURNING *
    `
  })

  // Una sola request HTTP, BEGIN/COMMIT en Neon: o entran todas las filas, o ninguna.
  const results = (await sql.transaction([matchInsert, ...mpInserts])) as any[]
  const match = results[0][0]
  const matchPlayers = results.slice(1).map((rows, i) => ({
    ...rows[0],
    players: resolvedPlayers[i].dbPlayer,
  }))

  return { ...match, match_players: matchPlayers } as MatchWithPlayers
}

export async function deleteMatch(matchId: string): Promise<void> {
  const parsed = UuidSchema.parse(matchId)
  await sql`DELETE FROM matches WHERE id = ${parsed}`
}

// ────────────────────────────────────────────────────────────────────────────
// Statistics
// ────────────────────────────────────────────────────────────────────────────

export async function getPlayerStats(tournamentId: string): Promise<PlayerStats[]> {
  const parsed = UuidSchema.parse(tournamentId)
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
    WHERE m.tournament_id = ${parsed}
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
  const parsedName = PlayerNameSchema.parse(playerName)
  const parsedTournament = UuidSchema.parse(tournamentId)
  const rows = await sql`
    SELECT mp.position, mp.money_won, m.date
    FROM match_players mp
    JOIN matches m ON m.id = mp.match_id
    JOIN players p ON p.id = mp.player_id
    WHERE p.name = ${parsedName} AND m.tournament_id = ${parsedTournament}
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
  const parsed = UuidSchema.parse(tournamentId)
  const [matchesResult, playersResult] = await Promise.all([
    sql`
      SELECT
        COUNT(DISTINCT m.id)::int               AS total_matches,
        COALESCE(SUM(DISTINCT m.total_money), 0)::int AS total_money,
        COALESCE(SUM(mp.cajitas), 0)::int       AS total_cajitas
      FROM matches m
      LEFT JOIN match_players mp ON mp.match_id = m.id
      WHERE m.tournament_id = ${parsed}
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
// Active matches
// ────────────────────────────────────────────────────────────────────────────

export async function getAllActiveMatches(tournamentId: string): Promise<ActiveMatch[]> {
  const parsed = UuidSchema.parse(tournamentId)
  const rows = await sql`
    SELECT * FROM active_matches
    WHERE tournament_id = ${parsed}
    ORDER BY created_at DESC
  `
  return rows as ActiveMatch[]
}

export async function getActiveMatchById(matchId: string): Promise<ActiveMatch | null> {
  const parsed = UuidSchema.parse(matchId)
  const rows = await sql`
    SELECT * FROM active_matches WHERE id = ${parsed} LIMIT 1
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
  const validated = CreateActiveMatchSchema.parse(matchData)
  const playersWithTieBreak = validated.players.map((p) => ({
    ...p,
    tieBreak: p.tieBreak ?? Math.random(),
  }))

  const rows = await sql`
    INSERT INTO active_matches
      (date, caji_value, player_count, tournament_id, players)
    VALUES (
      ${validated.date},
      ${validated.cajiValue},
      ${validated.playerCount},
      ${validated.tournamentId},
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
  const parsedId = UuidSchema.parse(matchId)
  const validated = UpdateActiveMatchSchema.parse(matchData)
  const playersWithTieBreak = validated.players.map((p) => ({
    ...p,
    tieBreak: p.tieBreak ?? Math.random(),
  }))

  const rows = await sql`
    UPDATE active_matches
    SET date = ${validated.date},
        caji_value = ${validated.cajiValue},
        player_count = ${validated.playerCount},
        players = ${JSON.stringify(playersWithTieBreak)}::jsonb,
        updated_at = NOW()
    WHERE id = ${parsedId}
    RETURNING *
  `
  return rows[0] as ActiveMatch
}

export async function deleteActiveMatch(matchId: string): Promise<void> {
  const parsed = UuidSchema.parse(matchId)
  await sql`DELETE FROM active_matches WHERE id = ${parsed}`
}

export async function registerActiveMatch(matchId: string): Promise<MatchWithPlayers> {
  const parsed = UuidSchema.parse(matchId)
  const rows = await sql`SELECT * FROM active_matches WHERE id = ${parsed} LIMIT 1`
  const activeMatch = rows[0] as ActiveMatch | undefined
  if (!activeMatch) throw new Error(`Active match ${parsed} not found`)

  const realMatch = await createMatch({
    date: activeMatch.date,
    cajiValue: activeMatch.caji_value,
    tournamentId: activeMatch.tournament_id,
    players: activeMatch.players,
  })

  await deleteActiveMatch(parsed)
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
