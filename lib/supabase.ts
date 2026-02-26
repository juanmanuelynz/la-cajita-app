import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gtefxclgtmgbkkdfbnwi.supabase.co"
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0ZWZ4Y2xndG1nYmtrZGZibndpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2MjQ4OTEsImV4cCI6MjA2NjIwMDg5MX0.MdTx0_pJdrkhhuSLtg7phuvJMazhxaa8j501-OrgO5A"

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
}
