export interface Player {
  id: string
  name: string
  created_at: string
}

export interface Match {
  id: string
  date: string
  caji_value: number
  total_money: number
  player_count: number
  /** Partida suelta: no suma puntos ni cuenta para el ranking/estadísticas. */
  is_casual?: boolean
  created_at: string
}

export interface MatchPlayer {
  id: string
  match_id: string
  player_id: string
  cajitas: number
  final_chips: number
  money_won: number
  position: number
  points: number
  tie_break: number
  created_at: string
  player?: Player
}

export interface MatchWithPlayers extends Match {
  match_players: (MatchPlayer & { players: Player })[]
}

export interface PlayerStats {
  id: string
  name: string
  points: number
  matches: number
  cajitas: number
  moneyWon: number
  averagePerMatch: number
  tournaments?: number
}

export interface ActiveMatch {
  id: string
  date: string
  caji_value: number
  player_count: number
  tournament_id: string
  is_casual?: boolean
  players: Array<{
    name: string
    cajitas: number
    finalChips: number
    moneyWon: number
    tieBreak?: number
  }>
  created_at: string
  updated_at: string
}

export interface Tournament {
  id: string
  name: string
  closed_at: string | null
  created_at: string
  points_config: number[]
}

export interface TrainingTally {
  right: number
  total: number
}

export interface TrainingProgress {
  /** Aciertos por ejercicio (clave: id del ejercicio). */
  byDrill: Record<string, TrainingTally>
  /** Aciertos por juego y mazo (clave: "holdem:long", etc.). */
  byVariant: Record<string, TrainingTally>
  /** Aciertos por ejercicio, juego y mazo juntos (clave: "potOdds:omaha:short"): para "Tus puntos débiles". */
  byDrillVariant: Record<string, TrainingTally>
  /** Aciertos por calle ("preflop", "flop", "turn", "river"). */
  byStreet?: Record<string, TrainingTally>
  /** Aciertos por lugar en la mesa (solo Antes del flop: "primero", "medio", "reparte", "ciega"). */
  bySeat?: Record<string, TrainingTally>
  /** Aciertos por semana (lunes, "YYYY-MM-DD"), las últimas 8 con respuestas. */
  byWeek?: (TrainingTally & { week: string })[]
  /** Fechas (YYYY-MM-DD) en que entrenó, de la más nueva a la más vieja. */
  days: string[]
  /** Respuestas de hoy. */
  today: TrainingTally
}

export interface DailyResult {
  player_id: string
  name: string
  score: number
  total: number
}
