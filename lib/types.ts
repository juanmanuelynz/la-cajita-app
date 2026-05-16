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
}

export interface ActiveMatch {
  id: string
  date: string
  caji_value: number
  player_count: number
  tournament_id: string
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
