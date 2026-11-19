"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowUp, RotateCcw, Share2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChipRain } from "@/components/chip-rain"
import { ChipSpinner, PokerChip } from "@/components/poker-chip"
import { useCountUp } from "@/hooks/use-count-up"
import { formatAmount, formatDate } from "@/lib/formatters"
import { buildMatchSummary, type RankingMove, type SummaryPlayer } from "@/lib/match-summary"
import { renderShareCard, shareImage } from "@/lib/share-card"
import type { SortBy } from "@/lib/stats"
import type { MatchWithPlayers } from "@/lib/types"

// Línea de tiempo de la revelación (ms desde que se abre el resumen).
const T = {
  third: 300,
  second: 1000,
  first: 1700,
  rain: 2050,
  rest: 2400,
  highlights: 2800,
  ranking: 3300,
  rankingSwap: 4300,
}

const PODIUM = [
  { body: "#eab308", edge: "#fefce8", block: "h-28 bg-yellow-500/25 border-yellow-500", text: "text-yellow-500", delay: T.first },
  { body: "#94a3b8", edge: "#f8fafc", block: "h-20 bg-slate-400/20 border-slate-400", text: "text-slate-400", delay: T.second },
  { body: "#f97316", edge: "#fff7ed", block: "h-14 bg-orange-500/20 border-orange-500", text: "text-orange-500", delay: T.third },
]

const ROW_H = 44

function signedMoney(n: number) {
  return `${n > 0 ? "+" : n < 0 ? "-" : ""}$${formatAmount(Math.abs(n))}`
}

function PodiumSpot({ player, place }: { player: SummaryPlayer; place: 0 | 1 | 2 }) {
  const style = PODIUM[place]
  const money = useCountUp(player.moneyWon, { delayMs: style.delay + 250, durationMs: 1100 })
  return (
    <div className="flex w-1/3 flex-col items-center justify-end">
      <div className="reveal-up flex flex-col items-center gap-1 pb-2" style={{ animationDelay: `${style.delay}ms` }}>
        <PokerChip
          className={place === 0 ? "winner-glow h-14 w-14" : "h-10 w-10"}
          body={style.body}
          edge={style.edge}
          suit={place === 0 ? "♠" : place === 1 ? "♥" : "♦"}
        />
        <div className={`max-w-full truncate px-1 text-center font-bold ${place === 0 ? "text-lg" : "text-sm"}`}>
          {player.name}
        </div>
        <div
          className={`font-semibold tabular-nums ${place === 0 ? "text-base" : "text-xs"} ${
            player.moneyWon >= 0 ? "text-emerald-500" : "text-rose-500"
          }`}
        >
          {signedMoney(money)}
        </div>
        <div className="text-[11px] text-muted-foreground">{player.points} pts</div>
      </div>
      <div
        className={`podium-rise flex w-full items-start justify-center rounded-t-xl border-2 border-b-0 pt-2 ${style.block}`}
        style={{ animationDelay: `${style.delay - 150}ms` }}
      >
        <span className={`text-2xl font-black ${style.text}`}>{player.position}°</span>
      </div>
    </div>
  )
}

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
  const [shareBlob, setShareBlob] = useState<Blob | null>(null)
  const [shareMsg, setShareMsg] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setRain(1), T.rain)
    return () => clearTimeout(t)
  }, [])

  // La imagen se genera de antemano: en iOS, navigator.share tiene que
  // llamarse inmediatamente después del toque, sin esperas en el medio.
  useEffect(() => {
    let cancelled = false
    renderShareCard({
      title: "Resultado de la partida",
      subtitle: `${tournamentName ? `${tournamentName} · ` : ""}${formatDate(match.date)}`,
      players: summary.players,
      highlights: summary.highlights,
      formatMoney: formatAmount,
    })
      .then((b) => !cancelled && setShareBlob(b))
      .catch(() => !cancelled && setShareBlob(null))
    return () => {
      cancelled = true
    }
  }, [summary, match.date, tournamentName])

  const handleShare = async () => {
    if (!shareBlob) return
    const res = await shareImage(
      shareBlob,
      `la-cajita-${match.date}.png`,
      `🃏 La Cajita · ${formatDate(match.date)}`,
    )
    setShareMsg(res === "downloaded" ? "Imagen descargada" : null)
  }

  const top3 = summary.players.slice(0, 3)
  const rest = summary.players.slice(3)

  return (
    <>
      <ChipRain trigger={rain} />
      <div className="container mx-auto max-w-lg px-4 pb-32 pt-[max(env(safe-area-inset-top),1rem)]">
        <div className="flex items-center justify-between py-2">
          <Button variant="ghost" size="icon" onClick={onReplay} aria-label="Repetir animación">
            <RotateCcw className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <h2 className="text-xl font-bold">Fin de la partida</h2>
            <p className="text-xs text-muted-foreground">
              {tournamentName ? `${tournamentName} · ` : ""}
              {formatDate(match.date)} · {match.player_count} jugadores
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Podio: 2° · 1° · 3° */}
        <div className="mt-6 flex items-end gap-2">
          {top3[1] && <PodiumSpot player={top3[1]} place={1} />}
          {top3[0] && <PodiumSpot player={top3[0]} place={0} />}
          {top3[2] && <PodiumSpot player={top3[2]} place={2} />}
        </div>
        <div className="h-1 rounded-full bg-border" />

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

      <div className="fixed inset-x-0 bottom-0 border-t bg-background/90 backdrop-blur-sm pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3">
        <div className="container mx-auto flex max-w-lg gap-3 px-4">
          <Button variant="outline" className="h-12 flex-1" onClick={handleShare} disabled={!shareBlob}>
            {shareBlob ? <Share2 className="mr-2 h-4 w-4" /> : <ChipSpinner className="mr-2 h-4 w-4" />}
            {shareMsg ?? "Compartir"}
          </Button>
          <Button className="h-12 flex-1" onClick={onClose}>
            Listo
          </Button>
        </div>
      </div>
    </>
  )
}

/** Pantalla completa de "Fin de la partida" con la revelación animada. */
export function MatchSummary(props: MatchSummaryProps) {
  const [replayKey, setReplayKey] = useState(0)
  const { onClose } = props

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
    }
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Resumen de la partida"
      className="animate-fade-in fixed inset-0 z-[100] overflow-y-auto bg-background"
    >
      <div
        aria-hidden
        className="pointer-events-none fixed left-1/2 top-0 h-72 w-72 -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/25 blur-3xl"
      />
      <div className="relative">
        <SummaryContent key={replayKey} {...props} onReplay={() => setReplayKey((k) => k + 1)} />
      </div>
    </div>
  )
}
