"use client"

import { useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Trophy, Medal, Award, Coins, Star } from "lucide-react"
import { formatAmount } from "@/lib/formatters"
import { sortPlayerStats } from "@/lib/stats"
import type { MatchWithPlayers, PlayerStats, Tournament } from "@/lib/types"

interface TournamentClosingPodiumProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tournament: Tournament | undefined
  playerStats: PlayerStats[]
  matches: MatchWithPlayers[]
}

const PODIUM_STYLES = [
  {
    rank: 1,
    icon: Trophy,
    bg: "bg-yellow-500/20 border-yellow-500",
    iconColor: "text-yellow-500",
    label: "1°",
  },
  {
    rank: 2,
    icon: Medal,
    bg: "bg-slate-400/20 border-slate-400",
    iconColor: "text-slate-400",
    label: "2°",
  },
  {
    rank: 3,
    icon: Award,
    bg: "bg-orange-500/20 border-orange-500",
    iconColor: "text-orange-500",
    label: "3°",
  },
]

function Podium({
  title,
  subtitle,
  top3,
  metric,
}: {
  title: string
  subtitle: string
  top3: PlayerStats[]
  metric: "money" | "points"
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="space-y-2">
        {PODIUM_STYLES.map((style, idx) => {
          const player = top3[idx]
          const Icon = style.icon
          return (
            <div
              key={style.rank}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 ${
                player ? style.bg : "border-dashed border-muted"
              }`}
            >
              <Icon
                className={`w-6 h-6 ${player ? style.iconColor : "text-muted-foreground"}`}
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground">{style.label}</div>
                <div className="font-semibold truncate">
                  {player?.name ?? "—"}
                </div>
              </div>
              <div className="text-right">
                {player ? (
                  metric === "money" ? (
                    <>
                      <div
                        className={`font-bold ${
                          player.moneyWon >= 0 ? "text-emerald-500" : "text-rose-500"
                        }`}
                      >
                        ${formatAmount(player.moneyWon)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {player.points} pts
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="font-bold">{player.points} pts</div>
                      <div
                        className={`text-xs ${
                          player.moneyWon >= 0 ? "text-emerald-500" : "text-rose-500"
                        }`}
                      >
                        ${formatAmount(player.moneyWon)}
                      </div>
                    </>
                  )
                ) : (
                  <div className="text-sm text-muted-foreground">—</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function TournamentClosingPodium({
  open,
  onOpenChange,
  tournament,
  playerStats,
  matches,
}: TournamentClosingPodiumProps) {
  const topByMoney = useMemo(
    () => sortPlayerStats(playerStats, "money").slice(0, 3),
    [playerStats],
  )
  const topByPoints = useMemo(
    () => sortPlayerStats(playerStats, "points").slice(0, 3),
    [playerStats],
  )

  const stats = useMemo(() => {
    const totalMatches = matches.length
    const totalMoneyMoved = matches.reduce((sum, m) => sum + (m.total_money || 0), 0)

    const mostActive = [...playerStats]
      .filter((p) => p.matches > 0)
      .sort((a, b) => b.matches - a.matches)[0]

    let bestSingleMatch: {
      player: string
      moneyWon: number
      date: string
    } | null = null
    for (const m of matches) {
      for (const mp of m.match_players) {
        if (!bestSingleMatch || mp.money_won > bestSingleMatch.moneyWon) {
          bestSingleMatch = {
            player: mp.players?.name ?? "—",
            moneyWon: mp.money_won,
            date: m.date,
          }
        }
      }
    }

    return { totalMatches, totalMoneyMoved, mostActive, bestSingleMatch }
  }, [matches, playerStats])

  const hasData = playerStats.some((p) => p.matches > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-500" />
            Podio Final
          </DialogTitle>
          <DialogDescription>
            {tournament?.name}
            {tournament?.closed_at
              ? ` · Cerrado el ${new Date(tournament.closed_at).toLocaleDateString("es-ES")}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {!hasData ? (
          <div className="py-8 text-center text-muted-foreground">
            Este torneo no tiene partidas registradas.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Podium
                title="Por dinero ganado"
                subtitle="Métrica principal del ranking anual"
                top3={topByMoney}
                metric="money"
              />
              <Podium
                title="Por puntos"
                subtitle="Métrica secundaria"
                top3={topByPoints}
                metric="points"
              />
            </div>

            <div className="border-t pt-4">
              <h3 className="text-lg font-bold mb-3">Resumen del torneo</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg border">
                  <div className="text-muted-foreground text-xs">Partidas</div>
                  <div className="font-bold text-lg">{stats.totalMatches}</div>
                </div>
                <div className="p-3 rounded-lg border">
                  <div className="text-muted-foreground text-xs flex items-center gap-1">
                    <Coins className="w-3 h-3" /> Plata movida
                  </div>
                  <div className="font-bold text-lg">
                    ${formatAmount(stats.totalMoneyMoved)}
                  </div>
                </div>
                {stats.mostActive && (
                  <div className="p-3 rounded-lg border">
                    <div className="text-muted-foreground text-xs">Más activo</div>
                    <div className="font-bold truncate">{stats.mostActive.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {stats.mostActive.matches} partidas
                    </div>
                  </div>
                )}
                {stats.bestSingleMatch && (
                  <div className="p-3 rounded-lg border">
                    <div className="text-muted-foreground text-xs flex items-center gap-1">
                      <Star className="w-3 h-3" /> Mejor partida
                    </div>
                    <div className="font-bold truncate">
                      {stats.bestSingleMatch.player}
                    </div>
                    <div
                      className={`text-xs ${
                        stats.bestSingleMatch.moneyWon >= 0
                          ? "text-emerald-500"
                          : "text-rose-500"
                      }`}
                    >
                      ${formatAmount(stats.bestSingleMatch.moneyWon)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
