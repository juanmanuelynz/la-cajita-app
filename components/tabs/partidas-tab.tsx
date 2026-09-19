"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Trash2,
  Loader2,
  Plus,
  Cannabis,
  ChevronDown,
  ChevronUp,
  Lock,
} from "lucide-react"
import { ActiveMatchCard } from "@/components/active-match-card"
import { formatAmount, formatDate } from "@/lib/formatters"
import type { ActiveMatch, MatchWithPlayers } from "@/lib/types"

type PartidasSubtab = "partida" | "historial"

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
}: PartidasTabProps) {
  const [subtab, setSubtab] = useState<PartidasSubtab>("partida")

  return (
    <Tabs
      value={subtab}
      onValueChange={(v) => setSubtab(v as PartidasSubtab)}
      className="w-full"
    >
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pt-3 pb-2 -mx-1 px-1">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="partida">Partida</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="partida" className="pt-4 pb-8 mt-0">
        <div className="space-y-4">
          {activeMatches.length === 0 ? (
            isTournamentClosed ? (
              <div className="rounded-2xl border-2 border-dashed border-muted-foreground/25 px-6 py-12 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Lock className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-xl font-bold">Torneo finalizado</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  No se pueden crear partidas nuevas
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={onCreateActive}
                disabled={loading}
                className="group relative w-full overflow-hidden rounded-2xl border-2 border-primary/50 bg-gradient-to-b from-primary/15 via-primary/5 to-transparent px-6 py-12 text-center shadow-lg shadow-primary/20 transition-all duration-200 hover:border-primary hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-70"
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-20 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-primary/25 blur-3xl"
                />

                <div className="relative flex flex-col items-center gap-5">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary/40 bg-primary/10 transition-transform duration-200 group-hover:scale-105">
                    {loading ? (
                      <Loader2 className="h-9 w-9 animate-spin text-primary" />
                    ) : (
                      <Cannabis className="h-9 w-9 text-primary" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="text-2xl font-bold tracking-tight">
                      ¿Sale?
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Tocá para arrancar una nueva partida
                    </p>
                  </div>

                  <span className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/30">
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creando...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Nueva partida
                      </>
                    )}
                  </span>
                </div>
              </button>
            )
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
      </TabsContent>

      <TabsContent value="historial" className="pt-4 pb-8 mt-0">
        <div className="space-y-1">
          <h2 className="text-xl font-normal mb-4">Historial de Partidas</h2>
          <div className="space-y-2">
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
      </TabsContent>
    </Tabs>
  )
}
