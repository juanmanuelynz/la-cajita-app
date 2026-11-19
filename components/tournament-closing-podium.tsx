"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Coins, Star, Users, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChipRain } from "@/components/chip-rain"
import {
  AnimatedPodium,
  CelebrationHeader,
  CelebrationOverlay,
  REVEAL,
  ShareFooter,
  signedMoney,
} from "@/components/celebration"
import { useCountUp } from "@/hooks/use-count-up"
import { formatAmount, formatDate } from "@/lib/formatters"
import type { Highlight, SummaryPlayer } from "@/lib/match-summary"
import { renderShareCard } from "@/lib/share-card"
import { sortPlayerStats } from "@/lib/stats"
import type { MatchWithPlayers, PlayerStats, Tournament } from "@/lib/types"

interface TournamentClosingPodiumProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tournament: Tournament | undefined
  playerStats: PlayerStats[]
  matches: MatchWithPlayers[]
}

// Lo que aparece después del podio (ms desde que se abre).
const T = {
  champion: 2300,
  points: 2900,
  stats: 3400,
  rest: 3900,
}

const MEDALS = ["bg-yellow-500 text-black", "bg-slate-400 text-black", "bg-orange-500 text-black"]

function toPodiumPlayer(p: PlayerStats, i: number): SummaryPlayer {
  return {
    playerId: p.id,
    name: p.name,
    position: i + 1,
    points: p.points,
    moneyWon: p.moneyWon,
    cajitas: p.cajitas,
  }
}

function StatTile({
  icon,
  label,
  value,
  detail,
  delay,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  detail?: React.ReactNode
  delay: number
}) {
  return (
    <div className="reveal-up rounded-xl border p-3" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon} {label}
      </div>
      <div className="truncate text-lg font-bold tabular-nums">{value}</div>
      {detail && <div className="text-xs text-muted-foreground">{detail}</div>}
    </div>
  )
}

function CountUp({ value, delayMs, money }: { value: number; delayMs: number; money?: boolean }) {
  const n = useCountUp(value, { delayMs, durationMs: 1000 })
  return <>{money ? `$${formatAmount(n)}` : n}</>
}

function PodiumContent({
  tournament,
  playerStats,
  matches,
  onClose,
  onReplay,
}: Omit<TournamentClosingPodiumProps, "open" | "onOpenChange"> & {
  onClose: () => void
  onReplay: () => void
}) {
  const byMoney = useMemo(() => sortPlayerStats(playerStats, "money"), [playerStats])
  const byPoints = useMemo(() => sortPlayerStats(playerStats, "points").slice(0, 3), [playerStats])

  const stats = useMemo(() => {
    const totalMoneyMoved = matches.reduce((sum, m) => sum + Number(m.total_money || 0), 0)
    const mostActive = [...playerStats]
      .filter((p) => p.matches > 0)
      .sort((a, b) => b.matches - a.matches)[0]
    let best: { player: string; moneyWon: number; date: string } | null = null
    for (const m of matches) {
      for (const mp of m.match_players) {
        if (!best || mp.money_won > best.moneyWon) {
          best = { player: mp.players?.name ?? "—", moneyWon: Number(mp.money_won), date: m.date }
        }
      }
    }
    return { totalMatches: matches.length, totalMoneyMoved, mostActive, best }
  }, [matches, playerStats])

  const [rain, setRain] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setRain(1), REVEAL.rain)
    return () => clearTimeout(t)
  }, [])

  const champion = byMoney[0]
  const closedOn = tournament?.closed_at ? formatDate(tournament.closed_at.slice(0, 10)) : null
  const subtitle = `${tournament?.name ?? "Torneo"}${closedOn ? ` · cerrado el ${closedOn}` : ""}`
  const podium = byMoney.slice(0, 3).map(toPodiumPlayer)
  const rest = byMoney.slice(3)

  const makeImage = useCallback(() => {
    // El campeón ya se ve en el podio de la imagen: los destacados suman otra cosa.
    const highlights: Highlight[] = []
    if (byPoints[0] && champion && byPoints[0].id !== champion.id) {
      highlights.push({ emoji: "⭐", text: `${byPoints[0].name} ganó por puntos (${byPoints[0].points} pts)` })
    }
    if (stats.best) {
      highlights.push({ emoji: "💰", text: `Mejor noche: ${stats.best.player} con +$${formatAmount(stats.best.moneyWon)}` })
    }
    highlights.push({
      emoji: "🃏",
      text: `${stats.totalMatches} partidas · $${formatAmount(stats.totalMoneyMoved)} en juego`,
    })
    return renderShareCard({
      title: "Ranking final del torneo",
      subtitle,
      players: byMoney.slice(0, 8).map(toPodiumPlayer),
      highlights,
      formatMoney: formatAmount,
    })
  }, [byMoney, byPoints, champion, stats, subtitle])

  return (
    <>
      <ChipRain trigger={rain} count={60} />
      <div className="container mx-auto max-w-lg px-4 pb-32 pt-[max(env(safe-area-inset-top),1rem)]">
        <CelebrationHeader title="Cierre del torneo" subtitle={subtitle} onReplay={onReplay} onClose={onClose} />

        <div className="mt-6">
          <AnimatedPodium top3={podium} />
        </div>

        {champion && (
          <div className="reveal-up mt-5 text-center" style={{ animationDelay: `${T.champion}ms` }}>
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-yellow-500">Campeón</div>
            <div className="winner-glow text-3xl font-black">👑 {champion.name}</div>
          </div>
        )}

        {byPoints.length > 0 && (
          <div className="reveal-up mt-8" style={{ animationDelay: `${T.points}ms` }}>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Por puntos</h3>
            <div className="space-y-1.5">
              {byPoints.map((p, i) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl bg-muted px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${MEDALS[i]}`}>
                      {i + 1}
                    </span>
                    <span className="font-medium">{p.name}</span>
                  </div>
                  <span className="text-sm font-semibold">{p.points} pts</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 grid grid-cols-2 gap-3">
          <StatTile
            icon={<Layers className="h-3 w-3" />}
            label="Partidas"
            value={<CountUp value={stats.totalMatches} delayMs={T.stats} />}
            delay={T.stats}
          />
          <StatTile
            icon={<Coins className="h-3 w-3" />}
            label="Plata en juego"
            value={<CountUp value={stats.totalMoneyMoved} delayMs={T.stats + 100} money />}
            delay={T.stats + 100}
          />
          {stats.mostActive && (
            <StatTile
              icon={<Users className="h-3 w-3" />}
              label="Más activo"
              value={stats.mostActive.name}
              detail={`${stats.mostActive.matches} partidas`}
              delay={T.stats + 200}
            />
          )}
          {stats.best && (
            <StatTile
              icon={<Star className="h-3 w-3" />}
              label="Mejor noche"
              value={stats.best.player}
              detail={
                <span className="text-emerald-500">
                  {signedMoney(stats.best.moneyWon)} · {formatDate(stats.best.date)}
                </span>
              }
              delay={T.stats + 300}
            />
          )}
        </div>

        {rest.length > 0 && (
          <div className="mt-8">
            <h3
              className="reveal-up mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
              style={{ animationDelay: `${T.rest}ms` }}
            >
              Resto del ranking
            </h3>
            <div className="space-y-1.5">
              {rest.map((p, i) => (
                <div
                  key={p.id}
                  className="reveal-up flex items-center justify-between rounded-xl bg-muted px-3 py-2"
                  style={{ animationDelay: `${T.rest + 80 + i * 70}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted-foreground text-xs font-bold text-muted">
                      {i + 4}
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
          </div>
        )}
      </div>

      <ShareFooter
        makeImage={makeImage}
        filename={`la-cajita-torneo-${(tournament?.name ?? "final").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`}
        text={`🏆 La Cajita · ${tournament?.name ?? "Torneo"}`}
        onClose={onClose}
      />
    </>
  )
}

/**
 * Cierre de torneo: pantalla completa con el podio final revelado 3°→2°→1°,
 * campeón, podio por puntos, resumen y botón para compartir la imagen.
 */
export function TournamentClosingPodium({
  open,
  onOpenChange,
  tournament,
  playerStats,
  matches,
}: TournamentClosingPodiumProps) {
  const close = useCallback(() => onOpenChange(false), [onOpenChange])
  if (!open) return null

  const hasData = playerStats.some((p) => p.matches > 0)
  if (!hasData) {
    return (
      <CelebrationOverlay label="Podio final" onClose={close}>
        {() => (
          <div className="container mx-auto flex min-h-[100dvh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
            <p className="text-lg font-semibold">{tournament?.name}</p>
            <p className="text-muted-foreground">Este torneo no tiene partidas registradas.</p>
            <Button onClick={close}>Cerrar</Button>
          </div>
        )}
      </CelebrationOverlay>
    )
  }

  return (
    <CelebrationOverlay label="Podio final del torneo" onClose={close}>
      {(onReplay) => (
        <PodiumContent
          tournament={tournament}
          playerStats={playerStats}
          matches={matches}
          onClose={close}
          onReplay={onReplay}
        />
      )}
    </CelebrationOverlay>
  )
}
