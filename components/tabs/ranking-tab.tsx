"use client"

import { useMemo } from "react"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ActiveMatchCard } from "@/components/active-match-card"
import { PokerChip } from "@/components/poker-chip"
import { formatAmount } from "@/lib/formatters"
import { lastMatchMovement } from "@/lib/match-summary"
import type { ActiveMatch, MatchWithPlayers, PlayerStats } from "@/lib/types"
import type { SortBy } from "@/lib/stats"

// Top 3: fondo de la fila y ficha del puesto (mismos colores que el podio).
const TOP3 = [
  { row: "bg-amber-100 dark:bg-yellow-800/40", body: "#eab308", edge: "#fefce8" },
  { row: "bg-zinc-200 dark:bg-slate-600/50", body: "#94a3b8", edge: "#f8fafc" },
  { row: "bg-orange-100 dark:bg-orange-800/40", body: "#f97316", edge: "#fff7ed" },
]

/** "↑2" / "↓1" debajo de la posición: cómo cambió con la última partida. */
function Movement({ delta }: { delta: number | null | undefined }) {
  // Sin movimiento igual reserva el alto, así todas las filas miden lo mismo.
  if (!delta) return <span className="block h-2.5" aria-hidden />
  return (
    <span
      className={`block h-2.5 text-[10px] font-bold leading-none ${delta > 0 ? "text-emerald-500" : "text-rose-500"}`}
      aria-label={delta > 0 ? `Subió ${delta}` : `Bajó ${-delta}`}
    >
      {delta > 0 ? "↑" : "↓"}
      {Math.abs(delta)}
    </span>
  )
}

export type RankingScope = "torneo" | "historico"

interface RankingTabProps {
  activeMatches: ActiveMatch[]
  /** Partidas del torneo seleccionado (para el movimiento con la última). */
  matches: MatchWithPlayers[]
  sortedPlayerStats: PlayerStats[]
  rankingScope: RankingScope
  onRankingScopeChange: (scope: RankingScope) => void
  rankingSortBy: SortBy
  onRankingSortChange: (sortBy: SortBy) => void
  loading: boolean
  onContinueActive: (id: string) => void
  onDeleteActive: (id: string) => void
}

export function RankingTab({
  activeMatches,
  matches,
  sortedPlayerStats,
  rankingScope,
  onRankingScopeChange,
  rankingSortBy,
  onRankingSortChange,
  loading,
  onContinueActive,
  onDeleteActive,
}: RankingTabProps) {
  // Solo en "Torneo actual": en el histórico no hay una "última partida".
  const movement = useMemo(
    () => (rankingScope === "torneo" ? lastMatchMovement(matches, rankingSortBy) : new Map<string, number | null>()),
    [matches, rankingScope, rankingSortBy],
  )

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

      <h2 className="text-2xl font-bold text-center">
        {rankingScope === "historico" ? "Tabla Histórica" : "Tabla Anual"}
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="py-2 px-2 text-left">Pos</th>
              <th className="py-2 px-2 text-left">Jugador</th>
              <th className="py-2 px-2 text-center">Dinero</th>
              <th className="py-2 px-2 text-center hidden md:table-cell landscape:table-cell">Puntos</th>
              <th className="py-2 px-2 text-center">Partidas</th>
              {rankingScope === "historico" && (
                <th className="py-2 px-2 text-center hidden md:table-cell landscape:table-cell">Torneos</th>
              )}
              <th className="py-2 px-2 text-center hidden md:table-cell landscape:table-cell">Cajitas</th>
              <th className="py-2 px-2 text-center hidden md:table-cell landscape:table-cell">Promedio/Partida</th>
            </tr>
          </thead>
          <tbody>
            {sortedPlayerStats.map((player, index) => (
              <tr key={player.id} className={`border-b ${TOP3[index]?.row ?? ""}`}>
                <td className="py-2 px-2">
                  <div className="flex w-7 flex-col items-center gap-0.5">
                    {TOP3[index] ? (
                      <PokerChip
                        className="h-7 w-7 drop-shadow-sm"
                        body={TOP3[index].body}
                        edge={TOP3[index].edge}
                        label={String(index + 1)}
                      />
                    ) : (
                      <span className="text-sm font-semibold">{index + 1}</span>
                    )}
                    <Movement delta={movement.get(player.id)} />
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
                <td className="py-3 px-2 text-center hidden md:table-cell landscape:table-cell font-bold text-sm">
                  {player.points}
                </td>
                <td className="py-3 px-2 text-center text-sm">{player.matches}</td>
                {rankingScope === "historico" && (
                  <td className="py-3 px-2 text-center hidden md:table-cell landscape:table-cell text-sm">
                    {player.tournaments}
                  </td>
                )}
                <td className="py-3 px-2 text-center hidden md:table-cell landscape:table-cell text-sm">
                  {player.cajitas}
                </td>
                <td
                  className={`py-3 px-2 text-center hidden md:table-cell landscape:table-cell text-sm ${
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
      <div className="grid grid-rows-[0fr] opacity-0 invisible transition-all duration-300 md:grid-rows-[1fr] md:opacity-100 md:visible md:animate-fade-in landscape:grid-rows-[1fr] landscape:opacity-100 landscape:visible">
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

      <div className="sticky bottom-0 z-10 bg-background/95 backdrop-blur-sm pt-2 pb-3 -mx-1 px-1">
        <Tabs
          value={rankingScope}
          onValueChange={(v) => onRankingScopeChange(v as RankingScope)}
        >
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="torneo">Torneo actual</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </div>
  )
}
