"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Trash2,
  Loader2,
  Plus,
  Cannabis,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { ActiveMatchCard } from "@/components/active-match-card"
import { formatAmount, formatDate } from "@/lib/formatters"
import type { ActiveMatch, MatchWithPlayers } from "@/lib/types"

interface PartidasTabProps {
  matches: MatchWithPlayers[]
  activeMatches: ActiveMatch[]
  expandedMatches: Set<string>
  loading: boolean
  isTournamentClosed: boolean
  onToggleExpand: (id: string) => void
  onCreateActive: () => void
  onContinueActive: (id: string) => void
  onDeleteActive: (id: string) => void
  onConfirmDeleteMatch: (id: string) => void
  onRefresh: () => void
}

export function PartidasTab({
  matches,
  activeMatches,
  expandedMatches,
  loading,
  isTournamentClosed,
  onToggleExpand,
  onCreateActive,
  onContinueActive,
  onDeleteActive,
  onConfirmDeleteMatch,
  onRefresh,
}: PartidasTabProps) {
  return (
    <div className="space-y-12">
      <div>
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold">Partidas</h2>
        </div>

        <div className="space-y-4">
          {activeMatches.length === 0 ? (
            <div className="space-y-2">
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8">
                <div className="text-center">
                  <p className="text-muted-foreground text-lg">
                    {isTournamentClosed ? "Torneo finalizado 🔒" : "¿Sa-Sa-Sa Sale?"}
                  </p>
                </div>
              </div>
              {!isTournamentClosed && (
                <Button
                  onClick={onCreateActive}
                  disabled={loading}
                  className="w-full"
                  variant="default"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Cannabis className="w-4 h-4 mr-2" />
                  )}
                  Nueva partida
                </Button>
              )}
            </div>
          ) : (
            activeMatches.map((match) => (
              <ActiveMatchCard
                key={match.id}
                match={match}
                loading={loading}
                onContinue={onContinueActive}
                onDelete={onDeleteActive}
              />
            ))
          )}
          {activeMatches.length > 0 && !isTournamentClosed && (
            <Button
              onClick={onCreateActive}
              disabled={loading}
              className="w-full mt-2"
              variant="outline"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Nueva partida
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex flex-row align-center justify-between">
          <div className="text-center mb-6">
            <h2 className="text-xl font-normal">Historial de Partidas</h2>
          </div>
          <Button onClick={onRefresh} disabled={loading} variant="outline" size="sm">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </div>
        <div className="max-h-200 overflow-y-auto space-y-2 custom-scrollbar">
          {matches.map((match) => {
            const isExpanded = expandedMatches.has(match.id)
            const winner = match.match_players.find((mp) => mp.position === 1)

            return (
              <Card key={match.id}>
                <CardContent className="p-4">
                  <div
                    className="flex justify-between items-start cursor-pointer hover:bg-muted rounded p-2 -m-2 transition-colors"
                    onClick={() => onToggleExpand(match.id)}
                  >
                    <div className="flex-1">
                      <div className="text-lg font-semibold">{formatDate(match.date)}</div>
                      <div className="text-sm text-muted-foreground">
                        {match.player_count} jugadores - ${formatAmount(match.total_money)}
                      </div>
                      {winner && (
                        <div className="text-sm mt-1">🏆 Ganador: {winner.players?.name}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="text-sm">
                          Dinero total jugado:{" "}
                          <span className="font-semibold">
                            ${formatAmount(match.total_money)}
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            onConfirmDeleteMatch(match.id)
                          }}
                          disabled={loading}
                        >
                          {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                        {match.match_players
                          .sort((a, b) => a.position - b.position)
                          .map((mp) => (
                            <div
                              key={mp.id}
                              className="flex items-center justify-between p-2 bg-muted rounded"
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                    mp.position === 1
                                      ? "bg-yellow-500 text-black"
                                      : mp.position === 2
                                        ? "bg-slate-400 text-black"
                                        : mp.position === 3
                                          ? "bg-orange-500 text-black"
                                          : "bg-muted-foreground text-muted"
                                  }`}
                                >
                                  {mp.position}
                                </div>
                                <span className="text-sm">{mp.players?.name}</span>
                              </div>
                              <span
                                className={`text-sm font-semibold ${
                                  mp.money_won >= 0 ? "text-emerald-500" : "text-rose-500"
                                }`}
                              >
                                ${formatAmount(mp.money_won)}{" "}
                                <span className="text-xs text-muted-foreground font-normal">
                                  ({mp.cajitas} cjt{mp.cajitas !== 1 ? "s" : ""})
                                </span>
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
