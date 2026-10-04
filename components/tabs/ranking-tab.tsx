"use client"

import { Trophy, Medal, Award } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { useTheme } from "next-themes"
import { ActiveMatchCard } from "@/components/active-match-card"
import { formatAmount } from "@/lib/formatters"
import type { ActiveMatch, PlayerStats } from "@/lib/types"
import type { SortBy } from "@/lib/stats"

interface RankingTabProps {
  activeMatches: ActiveMatch[]
  sortedPlayerStats: PlayerStats[]
  rankingSortBy: SortBy
  onRankingSortChange: (sortBy: SortBy) => void
  loading: boolean
  onContinueActive: (id: string) => void
  onDeleteActive: (id: string) => void
}

export function RankingTab({
  activeMatches,
  sortedPlayerStats,
  rankingSortBy,
  onRankingSortChange,
  loading,
  onContinueActive,
  onDeleteActive,
}: RankingTabProps) {
  const { theme } = useTheme()

  return (
    <div className="space-y-6">
      {activeMatches.length > 0 && (
        <div className="space-y-4 pb-6">
          {activeMatches.map((match) => (
            <ActiveMatchCard
              key={match.id}
              match={match}
              loading={loading}
              onContinue={onContinueActive}
              onDelete={onDeleteActive}
            />
          ))}
        </div>
      )}

      <h2 className="text-2xl font-bold text-center">Tabla Anual</h2>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="py-2 px-2 text-left">Pos</th>
              <th className="py-2 px-2 text-left">Jugador</th>
              <th className="py-2 px-2 text-center">Dinero</th>
              <th className="py-2 px-2 text-center hidden md:table-cell">Puntos</th>
              <th className="py-2 px-2 text-center">Partidas</th>
              <th className="py-2 px-2 text-center hidden md:table-cell">Cajitas</th>
              <th className="py-2 px-2 text-center hidden md:table-cell">Promedio/Partida</th>
            </tr>
          </thead>
          <tbody>
            {sortedPlayerStats.map((player, index) => (
              <tr
                key={player.id}
                className={`border-b ${
                  theme === "dark"
                    ? index === 0
                      ? "bg-yellow-800/40"
                      : index === 1
                        ? "bg-slate-600/50"
                        : index === 2
                          ? "bg-orange-800/40"
                          : ""
                    : index === 0
                      ? "bg-amber-100"
                      : index === 1
                        ? "bg-zinc-200"
                        : index === 2
                          ? "bg-orange-100"
                          : ""
                }`}
              >
                <td className="py-2 px-2">
                  <div className="flex items-center gap-1">
                    <span
                      className={`font-semibold text-sm ${
                        theme === "dark"
                          ? index === 0
                            ? "text-yellow-400"
                            : index === 1
                              ? "text-slate-300"
                              : index === 2
                                ? "text-orange-400"
                                : ""
                          : index === 0
                            ? "text-yellow-600"
                            : index === 1
                              ? "text-gray-600"
                              : index === 2
                                ? "text-orange-600"
                                : ""
                      }`}
                    >
                      {index + 1}
                    </span>
                    {index === 0 && (
                      <Trophy
                        className={`w-4 h-4 ${
                          theme === "dark" ? "text-yellow-400" : "text-yellow-600"
                        }`}
                      />
                    )}
                    {index === 1 && (
                      <Medal
                        className={`w-4 h-4 ${
                          theme === "dark" ? "text-slate-300" : "text-gray-600"
                        }`}
                      />
                    )}
                    {index === 2 && (
                      <Award
                        className={`w-4 h-4 ${
                          theme === "dark" ? "text-orange-400" : "text-orange-600"
                        }`}
                      />
                    )}
                  </div>
                </td>
                <td className="py-3 px-2 font-semibold text-sm">{player.name}</td>
                <td
                  className={`py-3 px-2 text-center font-semibold text-sm ${
                    player.moneyWon >= 0 ? "text-emerald-500" : "text-rose-500"
                  }`}
                >
                  ${formatAmount(player.moneyWon)}
                </td>
                <td className="py-3 px-2 text-center hidden md:table-cell font-bold text-sm">
                  {player.points}
                </td>
                <td className="py-3 px-2 text-center text-sm">{player.matches}</td>
                <td className="py-3 px-2 text-center hidden md:table-cell text-sm">
                  {player.cajitas}
                </td>
                <td
                  className={`py-3 px-2 text-center hidden md:table-cell text-sm ${
                    player.averagePerMatch >= 0 ? "text-emerald-500" : "text-rose-500"
                  }`}
                >
                  ${formatAmount(Math.round(player.averagePerMatch))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Collapsed on mobile; fades and expands in from md up. */}
      <div className="grid grid-rows-[0fr] opacity-0 invisible transition-all duration-300 md:grid-rows-[1fr] md:opacity-100 md:visible md:animate-fade-in">
        <div className="overflow-hidden">
          <div className="flex items-center justify-center gap-4 p-1">
            <span
              className={`text-sm font-medium ${
                rankingSortBy === "money" ? "" : "text-muted-foreground"
              }`}
            >
              Dinero
            </span>
            <Switch
              checked={rankingSortBy === "points"}
              onCheckedChange={(checked) => onRankingSortChange(checked ? "points" : "money")}
              aria-label="Cambiar orden de ranking"
            />
            <span
              className={`text-sm font-medium ${
                rankingSortBy === "points" ? "" : "text-muted-foreground"
              }`}
            >
              Puntos
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
