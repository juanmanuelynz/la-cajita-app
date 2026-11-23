"use client"

import { useCallback, useContext, useEffect, useMemo, useState } from "react"
import { CalendarCheck, Trophy, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import * as db from "@/lib/database"
import { getTodayLocalDate } from "@/lib/formatters"
import { playSound } from "@/lib/sounds"
import { DAILY_LENGTH, dailyChallenge, type DailyQuestion } from "@/lib/poker/training"
import { variantName } from "@/lib/poker/variants"
import type { DailyResult } from "@/lib/types"
import { cn } from "@/lib/utils"
import { TrainingContext } from "./drill-shell"
import { UsableDrill } from "./usable-drill"
import { WhoWinsDrill } from "./who-wins-drill"
import { OutsDrill } from "./outs-drill"
import { PotOddsDrill } from "./pot-odds-drill"
import { PreflopDrill } from "./preflop"
import { CompareDrill } from "./compare-drill"

const storageKey = (playerId: string, date: string) => `la-cajita:desafio:${playerId}:${date}`

function loadAnswers(playerId: string, date: string): boolean[] {
  try {
    const v = JSON.parse(localStorage.getItem(storageKey(playerId, date)) ?? "[]")
    return Array.isArray(v) ? v.filter((x) => typeof x === "boolean") : []
  } catch {
    return []
  }
}

function saveAnswers(playerId: string, date: string, answers: boolean[]) {
  try {
    localStorage.setItem(storageKey(playerId, date), JSON.stringify(answers))
  } catch {
    // sin storage: si recarga, arranca de nuevo
  }
}

function Question({ q, onNext, last }: { q: DailyQuestion; onNext: () => void; last: boolean }) {
  const common = { variant: q.variant, onNext, nextLabel: last ? "Ver resultado" : "Siguiente" }
  switch (q.drill) {
    case "usable":
      return <UsableDrill {...common} preset={q.data} />
    case "whoWins":
      return <WhoWinsDrill {...common} preset={q.data} />
    case "outs":
      return <OutsDrill {...common} preset={q.data} />
    case "potOdds":
      return <PotOddsDrill {...common} preset={q.data} />
    case "compare":
      return <CompareDrill {...common} preset={q.data} />
    case "preflop":
      return <PreflopDrill {...common} preset={q.data} />
  }
}

function Leaderboard({ rows, playerId }: { rows: DailyResult[] | null; playerId: string | null }) {
  if (!rows) return <p className="text-xs text-muted-foreground">Cargando ranking…</p>
  if (rows.length === 0) return <p className="text-xs text-muted-foreground">Todavía nadie lo jugó hoy.</p>
  return (
    <ol className="space-y-1">
      {rows.map((r, i) => (
        <li
          key={r.player_id}
          className={cn(
            "flex items-center gap-2 rounded px-2 py-1 text-sm",
            r.player_id === playerId && "bg-primary/15 font-medium",
          )}
        >
          <span className="w-5 text-muted-foreground tabular-nums">{i + 1}</span>
          <span className="flex-1 truncate">{r.name}</span>
          {i === 0 && <Trophy className="w-3.5 h-3.5 text-amber-400" />}
          <span className="tabular-nums">
            {r.score}/{r.total}
          </span>
        </li>
      ))}
    </ol>
  )
}

/**
 * Desafío del día: 10 preguntas iguales para todo el grupo (salen de una
 * semilla con la fecha), un solo intento por jugador. Mientras se juega
 * ocupa toda la sección (`onActiveChange`).
 */
export function DailyChallenge({
  playerId,
  onActiveChange,
}: {
  playerId: string | null
  onActiveChange: (active: boolean) => void
}) {
  const [today] = useState(getTodayLocalDate)
  const [answers, setAnswers] = useState<boolean[]>([])
  const [running, setRunning] = useState(false)
  const [board, setBoard] = useState<DailyResult[] | null>(null)
  const [submitError, setSubmitError] = useState(false)
  const parent = useContext(TrainingContext)

  // Las preguntas se generan recién al empezar (son al azar con semilla; en el
  // servidor no hace falta calcularlas).
  const questions = useMemo(() => (running ? dailyChallenge(today) : null), [running, today])

  const refreshBoard = useCallback(() => {
    db.getDailyLeaderboard(today).then(setBoard, () => setBoard((b) => b ?? []))
  }, [today])

  useEffect(() => {
    setAnswers(playerId ? loadAnswers(playerId, today) : [])
    refreshBoard()
  }, [playerId, today, refreshBoard])

  useEffect(() => onActiveChange(running), [running, onActiveChange])

  const submitted = !!playerId && !!board?.some((r) => r.player_id === playerId)
  const mine = board?.find((r) => r.player_id === playerId)
  const finished = answers.length >= DAILY_LENGTH
  const score = answers.filter(Boolean).length

  const submit = useCallback(
    (all: boolean[]) => {
      if (!playerId) return
      setSubmitError(false)
      db.submitDailyResult({ playerId, date: today, score: all.filter(Boolean).length, total: DAILY_LENGTH }).then(
        refreshBoard,
        () => setSubmitError(true),
      )
    },
    [playerId, today, refreshBoard],
  )

  // Terminado y todavía sin guardar: guardar (también reintenta si al
  // terminar no había señal y después se vuelve a abrir la pestaña).
  useEffect(() => {
    if (finished && board && !submitted && playerId && !running) submit(answers)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, board, submitted, playerId, running])

  const onAnswer = useCallback(
    (...args: Parameters<NonNullable<typeof parent.onAnswer>>) => {
      parent.onAnswer?.(...args)
      if (!playerId) return
      setAnswers((prev) => {
        const next = [...prev, args[2]]
        saveAnswers(playerId, today, next)
        return next
      })
    },
    [parent, playerId, today],
  )
  const ctx = useMemo(() => ({ onAnswer }), [onAnswer])

  // ── Jugando ────────────────────────────────────────────────────────────
  if (running && questions) {
    return (
      <RunningChallenge
        questions={questions}
        answers={answers}
        startAt={Math.min(answers.length, DAILY_LENGTH - 1)}
        ctx={ctx}
        onFinish={() => {
          // El resultado lo guarda el efecto de "terminado sin guardar".
          setRunning(false)
          playSound("jingleMatch")
        }}
        onExit={() => setRunning(false)}
      />
    )
  }

  // ── Tarjeta ────────────────────────────────────────────────────────────
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <CalendarCheck className="w-4 h-4 text-amber-500" />
        <span className="font-semibold text-sm flex-1">Desafío del día</span>
        {(submitted || finished) && (
          <span className="text-sm tabular-nums font-semibold">
            {mine ? mine.score : score}/{DAILY_LENGTH}
          </span>
        )}
      </div>

      {submitted || finished ? (
        <>
          {submitError && (
            <p className="text-xs text-rose-500">
              No se pudo guardar tu resultado.{" "}
              <button type="button" className="underline" onClick={() => submit(answers)}>
                Reintentar
              </button>
            </p>
          )}
          <Leaderboard rows={board} playerId={playerId} />
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {DAILY_LENGTH} preguntas mezcladas de todos los juegos. Son las mismas para todo el grupo y hay un solo
            intento por día.
          </p>
          {board && board.length > 0 && (
            <p className="text-xs">
              Ya lo jugaron {board.length}. Mejor: {board[0].name} con {board[0].score}/{board[0].total}.
            </p>
          )}
          <Button className="w-full" disabled={!playerId} onClick={() => setRunning(true)}>
            {!playerId
              ? "Elegí quién sos para jugar"
              : answers.length > 0
                ? `Seguir (${answers.length}/${DAILY_LENGTH})`
                : "Empezar"}
          </Button>
        </>
      )}
    </div>
  )
}

function RunningChallenge({
  questions,
  answers,
  startAt,
  ctx,
  onFinish,
  onExit,
}: {
  questions: DailyQuestion[]
  answers: boolean[]
  startAt: number
  ctx: { onAnswer: NonNullable<React.ContextType<typeof TrainingContext>["onAnswer"]> }
  onFinish: () => void
  onExit: () => void
}) {
  // Índice de la pregunta en pantalla. Avanza solo con "Siguiente", así la
  // explicación queda visible después de responder.
  const [current, setCurrent] = useState(startAt)
  const q = questions[current]
  const last = current === questions.length - 1
  const right = answers.filter(Boolean).length

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2">
        <CalendarCheck className="w-4 h-4 text-amber-500" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">
            Desafío del día · {current + 1}/{questions.length}
          </div>
          <div className="text-xs text-muted-foreground">
            {variantName(q.variant)} · {right} bien
          </div>
        </div>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onExit} aria-label="Salir del desafío">
          <X className="w-4 h-4" />
        </Button>
      </div>
      <TrainingContext.Provider value={ctx}>
        <Question key={current} q={q} last={last} onNext={() => (last ? onFinish() : setCurrent((c) => c + 1))} />
      </TrainingContext.Provider>
    </div>
  )
}
