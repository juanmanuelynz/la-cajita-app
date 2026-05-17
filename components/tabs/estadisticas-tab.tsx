"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Award,
  CalendarDays,
  Cannabis,
  Coins,
  Flame,
  Rocket,
  Skull,
  Swords,
  TrendingUp,
  TrendingDown,
  Trophy,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { Line, Scatter } from "react-chartjs-2"
import { AdaptiveTooltip } from "@/components/adaptive-tooltip"
import { formatAmount, formatDate } from "@/lib/formatters"
import { EVOLUTION_COLORS } from "@/lib/constants"
import type { MatchWithPlayers, PlayerStats } from "@/lib/types"
import {
  getPlayerBestMatch,
  getPlayerWorstMatch,
  getPlayerLastMatches,
  getTopWinners,
  getPositionEvolutionData,
  getPlayerStreak,
  getPlayerNemesis,
  getPlayerFavoriteDay,
  getPlayerKillerMove,
  getROIPerMatchData,
  calculateEfficiencyAnalysis,
  formatForQuadrantChart,
  getTopWins,
  getTopLosses,
  type SortBy,
} from "@/lib/stats"

type StatsSubtab = "jugadores" | "rankings" | "analisis"

interface EstadisticasTabProps {
  matches: MatchWithPlayers[]
  sortedPlayerStats: PlayerStats[]
  expandedPlayerCards: Set<string>
  evolutionSortBy: SortBy
  onTogglePlayerCard: (id: string) => void
  onEvolutionSortChange: (s: SortBy) => void
}

export function EstadisticasTab({
  matches,
  sortedPlayerStats,
  expandedPlayerCards,
  evolutionSortBy,
  onTogglePlayerCard,
  onEvolutionSortChange,
}: EstadisticasTabProps) {
  const [subtab, setSubtab] = useState<StatsSubtab>("jugadores")
  const topWinners = getTopWinners(matches)
  const efficiency = calculateEfficiencyAnalysis(matches)
  const topWins = getTopWins(matches)
  const topLosses = getTopLosses(matches)

  return (
    <Tabs
      value={subtab}
      onValueChange={(v) => setSubtab(v as StatsSubtab)}
      className="w-full"
    >
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pt-3 pb-2 -mx-1 px-1">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="jugadores">Jugadores</TabsTrigger>
          <TabsTrigger value="rankings">Rankings</TabsTrigger>
          <TabsTrigger value="analisis">Análisis</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="jugadores" className="pt-4 pb-8 space-y-4 mt-0">
        {sortedPlayerStats.map((player) => {
          const isExpanded = expandedPlayerCards.has(player.id)
          const best = getPlayerBestMatch(matches, player.name)
          const worst = getPlayerWorstMatch(matches, player.name)
          const lastFive = getPlayerLastMatches(matches, player.name)
          const streak = getPlayerStreak(matches, player.name)
          const nemesis = getPlayerNemesis(matches, player.name)
          const favoriteDay = getPlayerFavoriteDay(matches, player.name)
          const killerMove = getPlayerKillerMove(matches, player.name)

          return (
            <Card key={player.id}>
              <CardContent className="p-0">
                <div
                  className="p-5 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => onTogglePlayerCard(player.id)}
                >
                  <div className="flex justify-between items-center">
                    <div className="text-2xl font-light">{player.name}</div>
                    <div className="flex items-center gap-3">
                      <div className="text-xl font-semibold">
                        ${formatAmount(player.moneyWon)}
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-5 pb-5 flex flex-col gap-2">
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="text-center">
                        <Award className="w-8 h-8 mx-auto mb-2" />
                        <div className="text-xl font-bold">{player.points}</div>
                        <div className="text-xs text-muted-foreground">Puntos</div>
                      </div>
                      <div className="text-center">
                        <Cannabis className="w-8 h-8 mx-auto mb-2" />
                        <div className="text-xl font-bold">{player.matches}</div>
                        <div className="text-xs text-muted-foreground">Partidas</div>
                      </div>
                      <div className="text-center">
                        <Coins className="w-8 h-8 mx-auto mb-2" />
                        <div className="text-xl font-bold">{player.cajitas}</div>
                        <div className="text-xs text-muted-foreground">Cajitas</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {best && (
                        <div className="flex flex-col items-center p-2 bg-emerald-800/30 rounded-lg">
                          <div className="flex items-center justify-between mb-2 w-full">
                            <div className="flex items-center gap-2">
                              <TrendingUp className="w-4 h-4 text-emerald-600" />
                              <span className="text-sm text-emerald-600 font-semibold">
                                P{best.position}
                              </span>
                            </div>
                            <div className="text-sm text-emerald-600 font-semibold">
                              ${formatAmount(best.moneyWon)}
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-emerald-50/50">
                              {formatDate(best.date)}
                            </div>
                          </div>
                        </div>
                      )}
                      {worst && (
                        <div className="flex flex-col items-center p-2 bg-rose-800/30 rounded-lg">
                          <div className="flex items-center justify-between mb-2 w-full">
                            <div className="flex items-center gap-2">
                              <TrendingDown className="w-4 h-4 text-rose-500" />
                              <span className="text-sm text-rose-500 font-semibold">
                                P{worst.position}
                              </span>
                            </div>
                            <div className="text-sm text-rose-500 font-semibold">
                              ${formatAmount(worst.moneyWon)}
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-rose-50/50">
                              {formatDate(worst.date)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {(streak.currentType ||
                      streak.bestWin > 1 ||
                      nemesis ||
                      favoriteDay) && (
                      <div className="flex flex-col gap-2 mb-3">
                        {(streak.currentType || streak.bestWin > 1) && (
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              {streak.currentType === "win" ? (
                                <Flame className="w-4 h-4 text-amber-500" />
                              ) : streak.currentType === "loss" ? (
                                <Skull className="w-4 h-4 text-rose-500" />
                              ) : (
                                <Flame className="w-4 h-4 text-muted-foreground" />
                              )}
                              <span>
                                {streak.currentType === "win"
                                  ? `${streak.current} ganadas seguidas`
                                  : streak.currentType === "loss"
                                    ? `${streak.current} perdidas seguidas`
                                    : "Sin racha actual"}
                              </span>
                            </div>
                            {streak.bestWin > 1 && (
                              <span className="text-xs text-muted-foreground">
                                Mejor: {streak.bestWin}W
                              </span>
                            )}
                          </div>
                        )}
                        {nemesis && (
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <Swords className="w-4 h-4 text-rose-500" />
                              <span>
                                Némesis: <strong>{nemesis.name}</strong>
                              </span>
                            </div>
                            <span className="text-xs text-rose-500">
                              -${formatAmount(nemesis.differential)} en{" "}
                              {nemesis.sharedMatches}
                            </span>
                          </div>
                        )}
                        {favoriteDay && (
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <CalendarDays className="w-4 h-4 text-cyan-500" />
                              <span>
                                Día favorito: <strong>{favoriteDay.dayName}</strong>
                              </span>
                            </div>
                            <span className="text-xs text-emerald-500">
                              +${formatAmount(favoriteDay.totalWon)} en{" "}
                              {favoriteDay.matchCount}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {killerMove && (
                      <div className="mb-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Rocket className="w-4 h-4 text-amber-500" />
                            <span className="text-sm font-semibold text-amber-500">
                              Killer move
                            </span>
                          </div>
                          <span className="text-lg font-bold text-amber-500">
                            {killerMove.roi.toFixed(0)}%
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {killerMove.cajitas} cajitas (${formatAmount(killerMove.investment)})
                          → +${formatAmount(killerMove.moneyWon)} · {formatDate(killerMove.date)}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-sm">Últimas 5 partidas</span>
                      <div className="flex gap-1">
                        {lastFive.slice(0, 5).map((match, index) => (
                          <div
                            key={index}
                            className={`w-5 h-5 rounded-sm flex items-center justify-center text-xs font-normal ${
                              match.moneyWon >= 0
                                ? "bg-emerald-500 text-white"
                                : "bg-rose-500 text-white"
                            }`}
                          >
                            {match.position}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </TabsContent>

      <TabsContent value="rankings" className="pt-4 pb-8 space-y-6 mt-0">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              🏆 Top 3 Ganadores de Partidas
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Jugadores con más victorias y su máximo pozo ganado
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {topWinners.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No hay datos de victorias disponibles</p>
              </div>
            ) : (
              <>
                {topWinners[0] && (
                  <Card className="border-2 border-yellow-500/50">
                    <CardContent className="p-4 flex flex-col gap-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="text-3xl">🥇</div>
                        <div>
                          <h3 className="font-bold text-lg">{topWinners[0].jugador}</h3>
                        </div>
                        <div className="ml-auto text-right">
                          <div className="text-2xl font-bold text-white">
                            {topWinners[0].victorias}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-center text-sm">
                        <div>
                          <div className="font-semibold text-white">
                            ${formatAmount(topWinners[0].maxPot)}
                          </div>
                          <div className="text-muted-foreground">Máximo Pozo</div>
                        </div>
                        <div>
                          <div className="font-semibold text-white">
                            {topWinners[0].maxPotCajitas}
                          </div>
                          <div className="text-muted-foreground">Cajitas</div>
                        </div>
                        <div>
                          <div className="font-semibold text-white">
                            {formatDate(topWinners[0].maxPotDate)}
                          </div>
                          <div className="text-muted-foreground">Fecha</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {topWinners.slice(1, 3).map((winner, index) => {
                    const medals = ["🥈", "🥉"]
                    const borderColors = ["border-gray-400/50", "border-orange-600/50"]
                    return (
                      <Card key={winner.jugador} className={`${borderColors[index]} border-2`}>
                        <CardContent className="p-3 text-center">
                          <div className="text-2xl mb-2">{medals[index]}</div>
                          <div className="font-semibold text-sm mb-1">{winner.jugador}</div>
                          <div className="text-lg font-bold text-white mb-1">
                            {winner.victorias}
                          </div>
                          <div className="text-xs text-muted-foreground mb-1">
                            ${formatAmount(winner.maxPot)} / {winner.maxPotCajitas}
                          </div>
                          <div className="text-xs text-white/70">
                            {formatDate(winner.maxPotDate)}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">💰 Mejores Partidas</CardTitle>
            <p className="text-sm text-muted-foreground">
              Las 3 partidas individuales con mayores ganancias
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {topWins.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Coins className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No hay datos disponibles</p>
              </div>
            ) : (
              <>
                {topWins[0] && (
                  <Card className="border-2 border-yellow-500/50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="text-3xl">🥇</div>
                        <div>
                          <h3 className="font-bold text-lg">{topWins[0].jugador}</h3>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(topWins[0].fecha)}
                          </p>
                        </div>
                        <div className="ml-auto text-right">
                          <div className="text-2xl font-bold text-emerald-600">
                            ${formatAmount(topWins[0].dinero_ganado)}
                          </div>
                          <p className="text-xs text-muted-foreground">Ganancia</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-center text-sm">
                        <div>
                          <div className="font-semibold text-white">{topWins[0].cajitas}</div>
                          <div className="text-muted-foreground">Cajitas</div>
                        </div>
                        <div>
                          <div className="font-semibold text-emerald-600">
                            ${formatAmount(topWins[0].dinero_ganado)}
                          </div>
                          <div className="text-muted-foreground">Ganado</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {topWins.slice(1, 3).map((p, index) => {
                    const medals = ["🥈", "🥉"]
                    const borderColors = ["border-gray-400/50", "border-orange-600/50"]
                    return (
                      <Card
                        key={`${p.jugador}-${p.fecha}`}
                        className={`${borderColors[index]} border-2`}
                      >
                        <CardContent className="p-3 text-center">
                          <div className="text-2xl mb-2">{medals[index]}</div>
                          <div className="font-semibold text-sm mb-1">{p.jugador}</div>
                          <div className="text-lg font-bold text-emerald-600 mb-1">
                            ${formatAmount(p.dinero_ganado)}
                          </div>
                          <div className="text-xs text-muted-foreground mb-1">
                            {formatDate(p.fecha)}
                          </div>
                          <div className="text-xs text-white/70">{p.cajitas} cajitas</div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">💸 Peores Partidas</CardTitle>
            <p className="text-sm text-muted-foreground">
              Las 3 partidas individuales con mayores pérdidas
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {topLosses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingDown className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No hay datos disponibles</p>
              </div>
            ) : (
              <>
                {topLosses[0] && (
                  <Card className="border-2 border-rose-500/50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="text-3xl">💔</div>
                        <div>
                          <h3 className="font-bold text-lg">{topLosses[0].jugador}</h3>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(topLosses[0].fecha)}
                          </p>
                        </div>
                        <div className="ml-auto text-right">
                          <div className="text-2xl font-bold text-rose-600">
                            ${formatAmount(topLosses[0].dinero_ganado)}
                          </div>
                          <p className="text-xs text-muted-foreground">Pérdida</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-center text-sm">
                        <div>
                          <div className="font-semibold text-white">{topLosses[0].cajitas}</div>
                          <div className="text-muted-foreground">Cajitas</div>
                        </div>
                        <div>
                          <div className="font-semibold text-rose-600">
                            ${formatAmount(topLosses[0].dinero_ganado)}
                          </div>
                          <div className="text-muted-foreground">Perdido</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {topLosses.slice(1, 3).map((p, index) => {
                    const emojis = ["😢", "😔"]
                    const borderColors = ["border-rose-400/50", "border-rose-300/50"]
                    return (
                      <Card
                        key={`${p.jugador}-${p.fecha}`}
                        className={`${borderColors[index]} border-2`}
                      >
                        <CardContent className="p-3 text-center">
                          <div className="text-2xl mb-2">{emojis[index]}</div>
                          <div className="font-semibold text-sm mb-1">{p.jugador}</div>
                          <div className="text-lg font-bold text-rose-600 mb-1">
                            ${formatAmount(p.dinero_ganado)}
                          </div>
                          <div className="text-xs text-muted-foreground mb-1">
                            {formatDate(p.fecha)}
                          </div>
                          <div className="text-xs text-white/70">{p.cajitas} cajitas</div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="analisis" className="pt-4 pb-8 space-y-6 mt-0">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              📈 Evolución de Posiciones
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Trayectoria del ranking de cada jugador fecha tras fecha
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center gap-4 pb-2">
              <span
                className={`text-sm font-medium ${
                  evolutionSortBy === "money" ? "" : "text-muted-foreground"
                }`}
              >
                Dinero
              </span>
              <Switch
                checked={evolutionSortBy === "points"}
                onCheckedChange={(checked) => onEvolutionSortChange(checked ? "points" : "money")}
                aria-label="Cambiar orden de evolución"
              />
              <span
                className={`text-sm font-medium ${
                  evolutionSortBy === "points" ? "" : "text-muted-foreground"
                }`}
              >
                Puntos
              </span>
            </div>

            {matches.length === 0 ? (
              <div className="text-center text-muted-foreground py-6">
                No hay datos de partidas
              </div>
            ) : (
              <div className="h-96">
                {(() => {
                  const { dates, evolutionData } = getPositionEvolutionData(
                    matches,
                    evolutionSortBy,
                  )
                  const datasets = Object.entries(evolutionData).map(
                    ([playerName, positions], index) => ({
                      label: playerName,
                      data: positions.map((p) => p.position),
                      borderColor: EVOLUTION_COLORS[index % EVOLUTION_COLORS.length],
                      backgroundColor: EVOLUTION_COLORS[index % EVOLUTION_COLORS.length],
                      tension: 0.3,
                      pointRadius: 4,
                      pointHoverRadius: 6,
                    }),
                  )

                  return (
                    <Line
                      data={{ labels: dates.map((d) => formatDate(d)), datasets }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { position: "bottom" as const, labels: { usePointStyle: true, padding: 15 } },
                          tooltip: {
                            callbacks: {
                              label: (context) => `${context.dataset.label}: Pos ${context.parsed.y}`,
                            },
                          },
                        },
                        scales: {
                          y: {
                            reverse: true,
                            beginAtZero: false,
                            ticks: {
                              stepSize: 1,
                              callback: function (value) {
                                return `${value}°`
                              },
                            },
                            title: { display: true, text: "Posición" },
                          },
                          x: {
                            title: { display: true, text: "Fecha" },
                            ticks: { maxRotation: 45, minRotation: 45 },
                          },
                        },
                      }}
                    />
                  )
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              🎢 ROI por partida
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Retorno de cada partida individual: ganancia neta ÷ inversión en cajitas
            </p>
          </CardHeader>
          <CardContent>
            {matches.length === 0 ? (
              <div className="text-center text-muted-foreground py-6">
                No hay datos de partidas
              </div>
            ) : (
              <div className="h-96">
                {(() => {
                  const { byPlayer } = getROIPerMatchData(matches)
                  const datasets = Object.entries(byPlayer).map(
                    ([playerName, series], index) => ({
                      label: playerName,
                      data: series.map((s) => ({ x: s.date, y: s.roi })),
                      borderColor: EVOLUTION_COLORS[index % EVOLUTION_COLORS.length],
                      backgroundColor: EVOLUTION_COLORS[index % EVOLUTION_COLORS.length],
                      tension: 0.3,
                      pointRadius: 3,
                      pointHoverRadius: 5,
                    }),
                  )
                  return (
                    <Line
                      data={{ datasets }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        parsing: false as unknown as undefined,
                        plugins: {
                          legend: {
                            position: "bottom" as const,
                            labels: { usePointStyle: true, padding: 15 },
                          },
                          tooltip: {
                            callbacks: {
                              title: (items) => formatDate(String(items[0].parsed.x)),
                              label: (ctx) =>
                                `${ctx.dataset.label}: ${(ctx.parsed.y as number).toFixed(0)}%`,
                            },
                          },
                        },
                        scales: {
                          y: {
                            title: { display: true, text: "ROI (%)" },
                            ticks: { callback: (v) => `${v}%` },
                          },
                          x: {
                            type: "category",
                            title: { display: true, text: "Fecha" },
                            ticks: {
                              maxRotation: 45,
                              minRotation: 45,
                              callback: function (value) {
                                const label = this.getLabelForValue(value as number)
                                return formatDate(label)
                              },
                            },
                          },
                        },
                      }}
                    />
                  )
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-2xl">Análisis de Eficiencia vs Inversión</CardTitle>
              <AdaptiveTooltip
                title="Análisis de Eficiencia"
                content={
                  <div className="space-y-2">
                    <p>
                      <strong>Eficiencia:</strong> Dinero ganado / Inversión total acumulada.
                    </p>
                    <p>
                      <strong>Cuadrantes:</strong>
                    </p>
                    <div className="space-y-1 text-sm">
                      <p>
                        🧠 <strong>Genio:</strong> Alta eficiencia, baja inversión
                      </p>
                      <p>
                        🎰 <strong>Apostador:</strong> Alta eficiencia, alta inversión
                      </p>
                      <p>
                        🛡️ <strong>Conservador:</strong> Baja eficiencia, baja inversión
                      </p>
                      <p>
                        🔥 <strong>Temerario:</strong> Baja eficiencia, alta inversión
                      </p>
                    </div>
                  </div>
                }
              >
                <HelpCircle className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer" />
              </AdaptiveTooltip>
            </div>
          </CardHeader>
          <CardContent>
            {efficiency.length > 0 ? (
              <div className="h-80">
                <Scatter
                  data={{ datasets: formatForQuadrantChart(matches) }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: "top" as const, labels: { usePointStyle: true } },
                      tooltip: {
                        callbacks: {
                          label: (context: any) => {
                            const dataPoint = context.raw
                            return `${dataPoint.jugador}: ${context.parsed.y.toFixed(
                              1,
                            )}% eficiencia, ${context.parsed.x.toFixed(1)} cajitas promedio`
                          },
                        },
                      },
                    },
                    scales: {
                      x: {
                        display: true,
                        title: { display: true, text: "Cajitas Promedio por Partida" },
                        min: 0,
                      },
                      y: {
                        display: true,
                        title: { display: true, text: "Eficiencia (%)" },
                        ticks: {
                          callback: function (value: any) {
                            return value + "%"
                          },
                        },
                      },
                    },
                    elements: { point: { radius: 8, hoverRadius: 10 } },
                  }}
                />
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Cannabis className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No hay datos de eficiencia disponibles</p>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
