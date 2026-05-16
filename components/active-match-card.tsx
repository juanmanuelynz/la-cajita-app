"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { formatAmount, formatDate } from "@/lib/formatters"
import type { ActiveMatch } from "@/lib/types"

interface ActiveMatchCardProps {
  match: ActiveMatch
  loading?: boolean
  onContinue: (id: string) => void
  onDelete: (id: string) => void
}

export function ActiveMatchCard({ match, loading, onContinue, onDelete }: ActiveMatchCardProps) {
  const playersWithNames = match.players.filter((p) => p.name.trim() !== "")
  const totalInvestment = match.players.reduce(
    (sum, p) => sum + p.cajitas * match.caji_value,
    0,
  )

  return (
    <Card className="border border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.45)]">
      <CardContent className="p-4 space-y-4">
        <div>
          <div className="flex justify-between items-center">
            <div className="text-xl font-bold">{formatDate(match.date)}</div>
            <div className="text-xl font-bold">${formatAmount(totalInvestment)}</div>
          </div>
          <div className="text-sm text-muted-foreground">
            {playersWithNames.length}/{match.player_count} jugadores
          </div>
        </div>
        {playersWithNames.length > 0 && (
          <div className="space-y-2">
            {playersWithNames
              .sort((a, b) => b.moneyWon - a.moneyWon)
              .map((player, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold border-2 ${
                        index === 0
                          ? "border-yellow-600 text-yellow-500"
                          : index === 1
                            ? "border-slate-500 text-slate-400"
                            : index === 2
                              ? "border-orange-700 text-orange-500"
                              : "border-muted-foreground text-muted-foreground"
                      }`}
                    >
                      {index + 1}
                    </div>
                    <span className="font-medium">
                      {player.name}{" "}
                      <span className="text-xs text-muted-foreground font-normal">
                        ({player.cajitas} cjt{player.cajitas !== 1 ? "s" : ""})
                      </span>
                    </span>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-lg font-bold ${
                        player.moneyWon >= 0 ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      ${formatAmount(player.moneyWon)}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="default" className="flex-1" onClick={() => onContinue(match.id)}>
            Continuar partida
          </Button>
          <Button variant="outline" onClick={() => onDelete(match.id)} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Borrar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
