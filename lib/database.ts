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
import { POINTS_DISTRIBUTION } from "./constants"
import { rankMatchPlayers } from "./ranking"

// Devolver fechas/timestamps como string ISO (igual que Supabase via PostgREST),
// en lugar de objetos Date nativos — React no puede renderizar Date como child.
// OIDs: 1082 = DATE, 1114 = TIMESTAMP, 1184 = TIMESTAMPTZ.
types.setTypeParser(1082, (val) => val)
types.setTypeParser(1114, (val) => val)
types.setTypeParser(1184, (val) => val)

const sql = neon(process.env.DATABASE_URL!)

// ────────────────────────────────────────────────────────────────────────────
// Players
// ────────────────────────────────────────────────────────────────────────────

export async function getAllPlayers(): Promise<Player[]> {
  const rows = await sql`
    SELECT id, name, created_at FROM players ORDER BY name
  `
  return rows as Player[]
}

export async function createPlayer(
  name: string,
  tournamentId?: string,
): Promise<Player> {
  const parsed = PlayerNameSchema.parse(name)
  // UPSERT por nombre: si ya existe, devolvemos el row sin modificarlo.
  // Si se pasa tournamentId, lo agregamos al roster del torneo en la misma
  // transacción HTTP — así "+ Crear nuevo jugador" desde una partida activa
  // queda visible en el dropdown sin tener que refrescar a mano.
  if (tournamentId) {
    const parsedTournament = UuidSchema.parse(tournamentId)
    const tx = (await sql.transaction([
      sql`
        INSERT INTO players (name) VALUES (${parsed})
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id, name, created_at
      `,
      sql`
        INSERT INTO tournament_players (tournament_id, player_id)
        SELECT ${parsedTournament}, id FROM players WHERE name = ${parsed}
        ON CONFLICT DO NOTHING
      `,
    ])) as Array<Array<Record<string, unknown>>>
    return tx[0][0] as unknown as Player
  }
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

export async function getTournamentRoster(
  tournamentId: string,
): Promise<Player[]> {
  const parsed = UuidSchema.parse(tournamentId)
  const rows = await sql`
    SELECT p.id, p.name, p.created_at
    FROM tournament_players tp
    JOIN players p ON p.id = tp.player_id
    WHERE tp.tournament_id = ${parsed}
    ORDER BY p.name
  `
  return rows as Player[]
}

export async function addPlayerToTournament(
  tournamentId: string,
  playerId: string,
): Promise<void> {
  const parsedTournament = UuidSchema.parse(tournamentId)
  const parsedPlayer = UuidSchema.parse(playerId)
  await sql`
    INSERT INTO tournament_players (tournament_id, player_id)
    VALUES (${parsedTournament}, ${parsedPlayer})
    ON CONFLICT DO NOTHING
  `
}

export async function removePlayerFromTournament(
  tournamentId: string,
  playerId: string,
): Promise<void> {
  const parsedTournament = UuidSchema.parse(tournamentId)
  const parsedPlayer = UuidSchema.parse(playerId)
  await sql`
    DELETE FROM tournament_players
    WHERE tournament_id = ${parsedTournament} AND player_id = ${parsedPlayer}
  `
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
  rosterIds?: string[],
): Promise<Tournament> {
  const parsedName = TournamentNameSchema.parse(name)
  const parsedConfig = PointsConfigSchema.parse(
    pointsConfig ?? POINTS_DISTRIBUTION,
  )
  const parsedRoster = (rosterIds ?? []).map((id) => UuidSchema.parse(id))

  const insertedRows = await sql`
    INSERT INTO tournaments (name, points_config)
    VALUES (${parsedName}, ${JSON.stringify(parsedConfig)}::jsonb)
    RETURNING *
  `
  const tournament = insertedRows[0] as Tournament

  if (parsedRoster.length > 0) {
    // Sembrar el roster inicial. Si falla, el torneo queda creado sin roster
    // y el usuario puede agregar jugadores desde la UI de gestión.
    await sql`
      INSERT INTO tournament_players (tournament_id, player_id)
      SELECT ${tournament.id}, unnest(${parsedRoster}::uuid[])
      ON CONFLICT DO NOTHING
    `
  }

  return tournament
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
    playerId?: string
    name: string
    cajitas: number
    finalChips: number
    moneyWon: number
    tieBreak?: number
  }>
}): Promise<MatchWithPlayers> {
  const validated = CreateMatchSchema.parse(matchData)

  // Ranking determinístico delegado a lib/ranking (testeable sin DB).
  const sortedPlayers = rankMatchPlayers(validated.players).map((r) => ({
    ...r.player,
    tieBreak: r.tieBreak,
  }))

  // Round-trip 1: leer points_config + resolver todos los jugadores en una
  // sola transacción HTTP. Cada jugador: lookup por id si vino playerId,
  // upsert por nombre si no (path legacy; ya no se ejercita en la práctica
  // porque todos los drafts modernos traen playerId).
  const resolveQueries = sortedPlayers.map((p) =>
    p.playerId
      ? sql`SELECT id, name, created_at FROM players WHERE id = ${p.playerId} LIMIT 1`
      : sql`
          INSERT INTO players (name) VALUES (${p.name})
          ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
          RETURNING id, name, created_at
        `,
  )
  const resolveTx = (await sql.transaction([
    sql`SELECT points_config FROM tournaments WHERE id = ${validated.tournamentId} LIMIT 1`,
    ...resolveQueries,
  ])) as Array<Array<Record<string, unknown>>>

  const tournamentRow = resolveTx[0][0] as { points_config: unknown } | undefined
  if (!tournamentRow) {
    throw new Error(`Torneo ${validated.tournamentId} no encontrado`)
  }
  const pointsConfig = PointsConfigSchema.parse(
    Array.isArray(tournamentRow.points_config)
      ? tournamentRow.points_config
      : POINTS_DISTRIBUTION,
  )

  const resolvedPlayers = sortedPlayers.map((p, i) => {
    const row = resolveTx[i + 1][0] as unknown as Player | undefined
    if (!row) throw new Error(`Jugador ${p.playerId ?? p.name} no encontrado`)
    return { ...p, dbPlayer: row }
  })

  const totalMoney = validated.players.reduce(
    (sum, p) => sum + p.cajitas * validated.cajiValue,
    0,
  )

  // Round-trip 2: insertar matches + N match_players atómicamente.
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

  const insertTx = (await sql.transaction([
    matchInsert,
    ...mpInserts,
  ])) as Array<Array<Record<string, unknown>>>
  const match = insertTx[0][0]
  const matchPlayers = insertTx.slice(1).map((rows, i) => ({
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
  type StatsRow = {
    id: string
    name: string
    points: number
    matches: number
    cajitas: number
    money_won: number
  }
  return (rows as StatsRow[]).map((r) => ({
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
    playerId?: string
    name: string
    cajitas: number
    finalChips: number
    moneyWon: number
    tieBreak?: number
  }>
}): Promise<ActiveMatch> {
  const validated = CreateActiveMatchSchema.parse(matchData)
  // No persistimos tieBreak en active_matches: el orden de carga se infiere
  // del orden del array y se materializa como tie_break entero en createMatch.
  const playersClean = validated.players.map(({ tieBreak: _omit, ...rest }) => rest)

  const rows = await sql`
    INSERT INTO active_matches
      (date, caji_value, player_count, tournament_id, players)
    VALUES (
      ${validated.date},
      ${validated.cajiValue},
      ${validated.playerCount},
      ${validated.tournamentId},
      ${JSON.stringify(playersClean)}::jsonb
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
      playerId?: string
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
  // Mismo razonamiento que en createActiveMatch: el orden del array es la
  // única fuente de verdad para desempates; tieBreak no se persiste acá.
  const playersClean = validated.players.map(({ tieBreak: _omit, ...rest }) => rest)

  const rows = await sql`
    UPDATE active_matches
    SET date = ${validated.date},
        caji_value = ${validated.cajiValue},
        player_count = ${validated.playerCount},
        players = ${JSON.stringify(playersClean)}::jsonb,
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

