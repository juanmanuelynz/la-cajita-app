"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, Lightbulb, Trophy, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CelebrationHeader, CelebrationOverlay } from "@/components/celebration"
import { ChipRain } from "@/components/chip-rain"
import { useCountUp } from "@/hooks/use-count-up"
import { formatDate } from "@/lib/formatters"
import { playSound } from "@/lib/sounds"
import { DRILL_NAMES, DRILL_TIPS, summarizeDaily, type DailyQuestion } from "@/lib/poker/training"
import { GAMES } from "@/lib/poker/variants"
import type { DailyResult } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Línea de tiempo de la pantalla (ms desde que se abre). */
const T = { score: 200, tiles: 900, tip: 2000, ranking: 2400 }

function ResultContent({
  date,
  questions,
  answers,
  board,
  playerId,
  onClose,
  onReplay,
}: {
  date: string
  questions: DailyQuestion[]
  answers: boolean[]
  board: DailyResult[] | null
  playerId: string | null
  onClose: () => void
  onReplay: () => void
}) {
  const summary = useMemo(() => summarizeDaily(questions.map((q) => q.drill), answers), [questions, answers])
  const shown = useCountUp(summary.score, { durationMs: 900, delayMs: T.score })
  const [rain, setRain] = useState(0)
  const good = summary.score / summary.total >= 0.7

  useEffect(() => {
    if (!good) return
    const t = setTimeout(() => {
      setRain(1)
      playSound("chipsRain")
    }, T.tiles)
    return () => clearTimeout(t)
  }, [good])

  const myRank = board ? board.findIndex((r) => r.player_id === playerId) : -1

  return (
    <>
      {good && <ChipRain trigger={rain} />}
      <div className="container mx-auto max-w-lg px-4 pb-32 pt-[max(env(safe-area-inset-top),1rem)]">
        <CelebrationHeader title="Desafío del día" subtitle={formatDate(date)} onReplay={onReplay} onClose={onClose} />

        {/* Puntaje */}
        <div className="reveal-up mt-6 flex flex-col items-center" style={{ animationDelay: `${T.score}ms` }}>
          <div
            className={cn(
              "flex h-36 w-36 flex-col items-center justify-center rounded-full border-4",
              good ? "border-emerald-500 bg-emerald-500/10" : "border-amber-500 bg-amber-500/10",
            )}
          >
            <div className="text-5xl font-black tabular-nums leading-none">
              {shown}
              <span className="text-2xl font-bold text-muted-foreground">/{summary.total}</span>
            </div>
          </div>
          <h3 className="mt-4 text-2xl font-bold">{summary.title}</h3>
          {myRank >= 0 && board && (
            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              {myRank === 0 && <Trophy className="h-4 w-4 text-amber-400" />}
              Vas {myRank + 1}º de {board.length} hoy
            </p>
          )}
        </div>

        {/* Pregunta por pregunta */}
        <div className="mt-8 grid grid-cols-2 gap-2">
          {questions.map((q, i) => {
            const ok = answers[i]
            return (
              <div
                key={i}
                className={cn(
                  "reveal-up flex items-center gap-2 rounded-xl border px-2.5 py-2",
                  ok ? "border-emerald-500/40 bg-emerald-500/10" : "border-rose-500/40 bg-rose-500/10",
                )}
                style={{ animationDelay: `${T.tiles + i * 80}ms` }}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white",
                    ok ? "bg-emerald-500" : "bg-rose-500",
                  )}
                >
                  {ok ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold">
                    {q.drill === "luz" || q.drill === "preflop" ? "Antes del flop" : DRILL_NAMES[q.drill]}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {GAMES[q.variant.game].name} · {q.variant.deck === "short" ? "Short" : "Long"}
                    {q.drill === "luz" ? " · luz" : q.drill === "preflop" ? " · ciegas" : ""}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Consejo */}
        <div
          className="reveal-up mt-6 flex gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3"
          style={{ animationDelay: `${T.tip}ms` }}
        >
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div className="text-sm">
            {summary.weakest ? (
              <>
                <div className="mb-0.5 font-semibold">Para la próxima · {DRILL_NAMES[summary.weakest]}</div>
                {DRILL_TIPS[summary.weakest]}
              </>
            ) : (
              <>
                <div className="mb-0.5 font-semibold">Sin errores</div>
                Mañana hay un desafío nuevo. Mientras tanto, probá los ejercicios en el juego que menos jugás.
              </>
            )}
          </div>
        </div>

        {/* Ranking del día */}
        {board && board.length > 0 && (
          <div className="reveal-up mt-6" style={{ animationDelay: `${T.ranking}ms` }}>
            <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Ranking de hoy</div>
            <ol className="space-y-1">
              {board.map((r, i) => (
                <li
                  key={r.player_id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm",
                    r.player_id === playerId ? "bg-primary/15 font-semibold" : "bg-muted",
                  )}
                >
                  <span className="w-5 tabular-nums text-muted-foreground">{i + 1}</span>
                  <span className="flex-1 truncate">{r.name}</span>
                  {i === 0 && <Trophy className="h-3.5 w-3.5 text-amber-400" />}
                  <span className="tabular-nums">
                    {r.score}/{r.total}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 backdrop-blur-sm">
        <div className="mx-auto max-w-lg">
          <Button className="w-full" size="lg" onClick={onClose}>
            Listo
          </Button>
        </div>
      </div>
    </>
  )
}

/** Resultado del Desafío del día a pantalla completa, como la celebración de fin de partida. */
export function ChallengeResult(props: {
  date: string
  questions: DailyQuestion[]
  answers: boolean[]
  board: DailyResult[] | null
  playerId: string | null
  onClose: () => void
}) {
  return (
    <CelebrationOverlay label="Resultado del desafío" onClose={props.onClose}>
      {(onReplay) => <ResultContent {...props} onReplay={onReplay} />}
    </CelebrationOverlay>
  )
}
