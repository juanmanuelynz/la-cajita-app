"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowUp } from "lucide-react"
import { ChipRain } from "@/components/chip-rain"
import {
  AnimatedPodium,
  CelebrationHeader,
  CelebrationOverlay,
  REVEAL,
  ShareFooter,
  signedMoney,
} from "@/components/celebration"
import { formatAmount, formatDate } from "@/lib/formatters"
import { buildMatchSummary, type RankingMove } from "@/lib/match-summary"
import { renderShareCard } from "@/lib/share-card"
import type { SortBy } from "@/lib/stats"
import type { MatchWithPlayers } from "@/lib/types"

// Lo que aparece después del podio (ms desde que se abre el resumen).
const T = {
  rest: 2400,
  highlights: 2800,
  ranking: 3300,
  rankingSwap: 4300,
}

const ROW_H = 44

function RankingBoard({ ranking, sortBy }: { ranking: RankingMove[]; sortBy: SortBy }) {
  const [swapped, setSwapped] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setSwapped(true), T.rankingSwap)
    return () => clearTimeout(t)
  }, [])

  // Orden "antes": por posición previa; los que debutan van al final.
  const beforeIndex = useMemo(() => {
    const ordered = [...ranking].sort((a, b) => {
      if (a.before === null && b.before === null) return a.after - b.after
      if (a.before === null) return 1
      if (b.before === null) return -1
      return a.before - b.before
    })
    return new Map(ordered.map((r, i) => [r.playerId, i]))
  }, [ranking])

  return (
    <div className="relative" style={{ height: ranking.length * ROW_H }}>
      {ranking.map((r) => {
        const idx = swapped ? r.after - 1 : beforeIndex.get(r.playerId) ?? 0
        return (
          <div
            key={r.playerId}
            className={`absolute inset-x-0 flex items-center gap-3 rounded-lg px-3 transition-transform duration-[900ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
              r.playedThisMatch ? "" : "opacity-50"
            }`}
            style={{ height: ROW_H - 4, transform: `translateY(${idx * ROW_H}px)` }}
          >
            <span className="w-6 text-right text-sm font-bold tabular-nums text-muted-foreground">
              {swapped ? r.after : (r.before ?? "–")}
            </span>
            <span className="flex-1 truncate font-medium">{r.name}</span>
            <span className="text-sm tabular-nums text-muted-foreground">
              {sortBy === "points" ? `${r.total} pts` : `${r.total < 0 ? "-" : ""}$${formatAmount(Math.abs(r.total))}`}
            </span>
            <span
              className={`flex w-12 items-center justify-end gap-0.5 text-xs font-bold transition-opacity duration-500 ${
                swapped ? "opacity-100" : "opacity-0"
              }`}
            >
              {r.before === null ? (
                <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary">NUEVO</span>
              ) : r.delta > 0 ? (
                <span className="flex items-center text-emerald-500">
                  <ArrowUp className="h-3.5 w-3.5" />
                  {r.delta}
                </span>
              ) : r.delta < 0 ? (
                <span className="flex items-center text-rose-500">
                  <ArrowDown className="h-3.5 w-3.5" />
                  {-r.delta}
                </span>
              ) : (
                <span className="text-muted-foreground">=</span>
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}

interface MatchSummaryProps {
  match: MatchWithPlayers
  tournamentMatches: MatchWithPlayers[]
  tournamentName?: string
  sortBy: SortBy
  onClose: () => void
}

function SummaryContent({ match, tournamentMatches, tournamentName, sortBy, onClose, onReplay }: MatchSummaryProps & { onReplay: () => void }) {
  const summary = useMemo(
    () => buildMatchSummary(match, tournamentMatches, sortBy, formatAmount),
    [match, tournamentMatches, sortBy],
  )
  const [rain, setRain] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setRain(1), REVEAL.rain)
    return () => clearTimeout(t)
  }, [])

  const subtitle = `${tournamentName ? `${tournamentName} · ` : ""}${formatDate(match.date)}`
  const makeImage = useCallback(
    () =>
      renderShareCard({
        title: "Resultado de la partida",
        subtitle,
        players: summary.players,
        highlights: summary.highlights,
        formatMoney: formatAmount,
      }),
    [summary, subtitle],
  )

  const top3 = summary.players.slice(0, 3)
  const rest = summary.players.slice(3)

  return (
    <>
      <ChipRain trigger={rain} />
      <div className="container mx-auto max-w-lg px-4 pb-32 pt-[max(env(safe-area-inset-top),1rem)]">
        <CelebrationHeader
          title="Fin de la partida"
          subtitle={`${subtitle} · ${match.player_count} jugadores`}
          onReplay={onReplay}
          onClose={onClose}
        />

        <div className="mt-6">
          <AnimatedPodium top3={top3} jingle="jingleMatch" />
        </div>

        {rest.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {rest.map((p, i) => (
              <div
                key={p.playerId}
                className="reveal-up flex items-center justify-between rounded-xl bg-muted px-3 py-2"
                style={{ animationDelay: `${T.rest + i * 90}ms` }}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted-foreground text-xs font-bold text-muted">
                    {p.position}
                  </span>
                  <span className="font-medium">{p.name}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className={`font-semibold tabular-nums ${p.moneyWon >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                    {signedMoney(p.moneyWon)}
                  </span>
                  <span className="w-12 text-right text-xs text-muted-foreground">{p.points} pts</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {summary.highlights.length > 0 && (
          <div className="mt-6 space-y-2">
            {summary.highlights.map((h, i) => (
              <div
                key={h.text}
                className="reveal-up flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3"
                style={{ animationDelay: `${T.highlights + i * 150}ms` }}
              >
                <span className="text-2xl">{h.emoji}</span>
                <span className="text-sm font-medium">{h.text}</span>
              </div>
            ))}
          </div>
        )}

        {summary.ranking.length > 0 && (
          <div className="reveal-up mt-8" style={{ animationDelay: `${T.ranking}ms` }}>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Ranking del torneo · por {sortBy === "points" ? "puntos" : "plata"}
            </h3>
            <RankingBoard ranking={summary.ranking} sortBy={sortBy} />
          </div>
        )}
      </div>

      <ShareFooter
        makeImage={makeImage}
        filename={`la-cajita-${match.date}.png`}
        text={`🃏 La Cajita · ${formatDate(match.date)}`}
        onClose={onClose}
      />
    </>
  )
}

/** Pantalla completa de "Fin de la partida" con la revelación animada. */
export function MatchSummary(props: MatchSummaryProps) {
  return (
    <CelebrationOverlay label="Resumen de la partida" onClose={props.onClose}>
      {(onReplay) => <SummaryContent {...props} onReplay={onReplay} />}
    </CelebrationOverlay>
  )
}
