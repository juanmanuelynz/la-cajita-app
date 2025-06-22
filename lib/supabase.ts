import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
