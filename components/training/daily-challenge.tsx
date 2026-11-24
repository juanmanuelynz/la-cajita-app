"use client"

import { useCallback, useContext, useEffect, useMemo, useState } from "react"
import { CalendarCheck, Trophy, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChipSpinner } from "@/components/poker-chip"
import * as db from "@/lib/database"
import { getTodayLocalDate } from "@/lib/formatters"
import { playSound } from "@/lib/sounds"
import { DAILY_LENGTH, dailyChallenge, type DailyQuestion } from "@/lib/poker/training"
import { GAMES } from "@/lib/poker/variants"
import type { DailyResult } from "@/lib/types"
import { cn } from "@/lib/utils"
import { TrainingContext } from "./drill-shell"
import { UsableDrill } from "./usable-drill"
import { WhoWinsDrill } from "./who-wins-drill"
import { OutsDrill } from "./outs-drill"
import { PotOddsDrill } from "./pot-odds-drill"
import { PreflopDrill } from "./preflop"
import { CompareDrill } from "./compare-drill"
import { ChallengeResult } from "./challenge-result"
import { LuzDrill } from "./luz-drill"
import { GtoDrill } from "./gto-drill"

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
    case "luz":
      return <LuzDrill {...common} preset={q.data} />
    case "preflop":
      return <PreflopDrill {...common} preset={q.data} />
    case "gto":
      return <GtoDrill {...common} preset={q.data} />
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

  // Las preguntas se generan recién al empezar y FUERA del render: tardan un
  // poco (simulaciones) y, calculadas durante el render, en el celular se veía
  // la pantalla a medio dibujar. Mientras tanto se muestra un "cargando".
  const [questions, setQuestions] = useState<DailyQuestion[] | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [showBoard, setShowBoard] = useState(false)
  useEffect(() => {
    if (!running || questions) return
    const t = setTimeout(() => setQuestions(dailyChallenge(today)), 50)
    return () => clearTimeout(t)
  }, [running, questions, today])

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
  if (running && !questions) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
        <ChipSpinner className="w-8 h-8" />
        Mezclando las cartas…
      </div>
    )
  }
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
          setShowResult(true)
          // 10/10: el jingle grande (el del cierre de torneo).
          playSound(answers.length >= DAILY_LENGTH && answers.every(Boolean) ? "jingleTournament" : "jingleMatch")
        }}
        onExit={() => setRunning(false)}
      />
    )
  }

  // Resultado a pantalla completa (al terminar, o con "Ver resultado").
  const result =
    showResult && questions && answers.length >= DAILY_LENGTH ? (
      <ChallengeResult
        date={today}
        questions={questions}
        answers={answers}
        board={board}
        playerId={playerId}
        onClose={() => setShowResult(false)}
      />
    ) : null

  // ── Tarjeta (una línea: el ejercicio tiene que quedar a la vista) ──────
  const done = submitted || finished
  const myPos = board ? board.findIndex((r) => r.player_id === playerId) : -1
  const status = !playerId
    ? "Elegí quién sos para jugar"
    : done
      ? `Sacaste ${mine ? mine.score : score}/${DAILY_LENGTH}${myPos >= 0 && board ? ` · vas ${myPos + 1}º de ${board.length}` : ""}`
      : answers.length > 0
        ? `Vas por la ${answers.length + 1} de ${DAILY_LENGTH}`
        : board && board.length > 0
          ? `${DAILY_LENGTH} preguntas · ya jugaron ${board.length}`
          : `${DAILY_LENGTH} preguntas, iguales para todos`

  const cta = done ? (
    finished ? (
      <Button
        size="sm"
        variant="outline"
        className="rounded-full border-amber-500/50"
        onClick={() => {
          setQuestions((q) => q ?? dailyChallenge(today))
          setShowResult(true)
        }}
      >
        Ver
      </Button>
    ) : null
  ) : (
    <Button
      size="sm"
      disabled={!playerId}
      className="rounded-full bg-amber-400 px-5 font-bold text-black shadow-[0_3px_0_0] shadow-amber-700 hover:bg-amber-300 active:translate-y-0.5 active:shadow-none"
      onClick={() => setRunning(true)}
    >
      {answers.length > 0 ? "Seguir" : "Jugar"}
    </Button>
  )

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/20 via-amber-500/5 to-card">
      {result}
      {/* Una sola línea: el ejercicio tiene que quedar a la vista. */}
      <div className="flex items-center gap-3 px-3 py-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-black shadow-[0_2px_0_0] shadow-amber-700">
          <CalendarCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold leading-tight">Desafío del día</div>
          <div className="truncate text-xs text-muted-foreground">{status}</div>
          {/* Cómo vas: solo con el desafío empezado. */}
          {answers.length > 0 && (
            <div className="mt-1 flex gap-0.5" aria-hidden>
              {Array.from({ length: DAILY_LENGTH }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full",
                    i < answers.length ? (answers[i] ? "bg-emerald-500" : "bg-rose-500") : "bg-amber-500/20",
                  )}
                />
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowBoard((b) => !b)}
          aria-label="Ranking del desafío"
          className="flex shrink-0 items-center gap-0.5 text-xs font-medium text-amber-500"
        >
          <Trophy className="h-4 w-4" />
          {board && board.length > 0 ? board.length : ""}
        </button>
        {cta}
      </div>
      {submitError && (
        <p className="px-3 pb-2 text-xs text-rose-500">
          No se pudo guardar tu resultado.{" "}
          <button type="button" className="underline" onClick={() => submit(answers)}>
            Reintentar
          </button>
        </p>
      )}
      {showBoard && (
        <div className="border-t border-amber-500/20 px-3 py-2">
          <Leaderboard rows={board} playerId={playerId} />
        </div>
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
    <div className="space-y-3">
      {/* Barra del desafío: progreso y salir */}
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 space-y-2">
        <div className="flex items-center gap-2">
          <CalendarCheck className="w-4 h-4 text-amber-500" />
          <span className="flex-1 text-sm font-semibold">Desafío del día</span>
          <span className="text-sm tabular-nums">
            <b>{current + 1}</b>
            <span className="text-muted-foreground">/{questions.length}</span>
          </span>
          <Button size="icon" variant="ghost" className="h-8 w-8 -mr-1" onClick={onExit} aria-label="Salir del desafío">
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex gap-1" aria-label={`${right} bien de ${answers.length}`}>
          {questions.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                i < answers.length ? (answers[i] ? "bg-emerald-500" : "bg-rose-500") : "bg-muted",
                i === current && i >= answers.length && "bg-amber-400",
              )}
            />
          ))}
        </div>
      </div>

      {/* Qué se juega en esta pregunta */}
      <div key={`v${current}`} className="animate-fade-in flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-lg font-bold leading-tight">
            {q.drill === "gto" ? "GTO en el river" : GAMES[q.variant.game].name}
          </div>
          <div className="text-xs text-muted-foreground">
            {q.drill === "gto" ? "Vale igual para todos los juegos" : GAMES[q.variant.game].short}
          </div>
        </div>
        <div className={cn("flex flex-col items-end gap-1", q.drill === "gto" && "hidden")}>
          <span
            className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
          >
            {q.variant.deck === "short" ? "Short · sin 2 a 5" : "Long · 52 cartas"}
          </span>
          {(q.drill === "luz" || q.drill === "preflop") && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-500">
              {q.drill === "luz" ? "Con luz" : "Con ciegas"}
            </span>
          )}
        </div>
      </div>

      <TrainingContext.Provider value={ctx}>
        <div key={current} className="animate-fade-in">
          <Question q={q} last={last} onNext={() => (last ? onFinish() : setCurrent((c) => c + 1))} />
        </div>
      </TrainingContext.Provider>
    </div>
  )
}
