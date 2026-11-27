"use client"

// Practicar (Truco): los tres ejercicios del artefacto, con progreso en la base
// (truco_answers). El jugador es el mismo que eligió en Entrenar (misma clave
// de localStorage); el nivel, la meta del día y la racha son propios de Truco.

import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, ChevronDown, ChevronLeft, ChevronRight, Flame, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { AnswerButton, answerTone } from "@/components/training/drill-shell"
import { Avatar, HIDDEN_TRAINEES, PlayerDrawer } from "@/components/training/progress-panel"
import { useBackToClose } from "@/hooks/use-back-to-close"
import * as db from "@/lib/database"
import { getTodayLocalDate } from "@/lib/formatters"
import { dayStreak } from "@/lib/poker/training"
import { MAKERS, QUIZ_TITLES, type Quiz } from "@/lib/truco/quizzes"
import { TRUCO_QUIZ_IDS, type TrucoQuizId } from "@/lib/truco/quiz-ids"
import { TRUCO_DAILY_GOAL, trucoLevelFor } from "@/lib/truco/training"
import type { Player, TrucoProgress } from "@/lib/types"
import { cn } from "@/lib/utils"
import { SpanishCard } from "./spanish-card"

/** La misma clave que Entrenar: el jugador se elige una vez por celular. */
const PLAYER_KEY = "la-cajita:entrenar:jugador"

const QUIZ_DESC: Record<TrucoQuizId, string> = {
  gana: "Dos cartas: ¿cuál gana la baza?",
  envido: "Contá el envido de tu mano.",
  puntos: "Cuánto vale lo que se cantó.",
}

/** Texto con partes en **negrita**. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("**").map((part, i) => (i % 2 ? <b key={i}>{part}</b> : <span key={i}>{part}</span>))}
    </>
  )
}

function GoalRing({ done, goal }: { done: number; goal: number }) {
  const r = 19
  const c = 2 * Math.PI * r
  const complete = done >= goal
  return (
    <div className="relative h-10 w-10" aria-label={`${done} de ${goal} hoy`}>
      <svg viewBox="0 0 48 48" className="h-10 w-10 -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" strokeWidth="5" className="stroke-muted" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, done / goal))}
          className="stroke-primary transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {complete ? <Check className="h-5 w-5 text-primary" strokeWidth={3} /> : <span className="text-xs font-bold tabular-nums">{done}</span>}
      </div>
    </div>
  )
}

function TrainerCard({
  player,
  progress,
  onPick,
}: {
  player: Player | undefined
  progress: TrucoProgress | null
  onPick: () => void
}) {
  if (!player) {
    return (
      <button
        type="button"
        onClick={onPick}
        className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-primary/50 bg-primary/5 p-3 text-left active:scale-[0.99]"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <UserRound className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">¿Quién sos?</div>
          <div className="text-xs text-muted-foreground">Elegí tu nombre para guardar tu progreso</div>
        </div>
        <ChevronDown className="h-5 w-5 text-muted-foreground" />
      </button>
    )
  }
  const right = progress ? Object.values(progress.byQuiz).reduce((a, t) => a + t.right, 0) : 0
  const lvl = trucoLevelFor(right)
  const streak = progress ? dayStreak(progress.days, getTodayLocalDate()) : 0
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-gradient-to-br from-primary/20 via-card to-card px-3 py-2">
      <button type="button" onClick={onPick} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label="Cambiar quién practica">
        <Avatar name={player.name} className="h-10 w-10" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="min-w-0 truncate font-bold leading-tight">{player.name}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1.5 min-w-6 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${(lvl.into / lvl.span) * 100}%` }} />
            </div>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              Nivel {lvl.level} · {lvl.title}
            </span>
          </div>
        </div>
      </button>
      {streak > 0 && (
        <div className="flex shrink-0 items-center gap-0.5 text-sm font-bold text-primary" title={`${streak} días seguidos`}>
          <Flame className="size-4" />
          {streak}
        </div>
      )}
      <GoalRing done={progress?.today.total ?? 0} goal={TRUCO_DAILY_GOAL} />
    </div>
  )
}

function QuizScreen({
  id,
  onClose,
  onAnswer,
}: {
  id: TrucoQuizId
  onClose: () => void
  onAnswer: (correct: boolean) => void
}) {
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const [session, setSession] = useState({ right: 0, total: 0, streak: 0 })

  // Se genera en el navegador (las cartas al azar no pueden salir del servidor).
  useEffect(() => setQuiz(MAKERS[id]()), [id])

  if (!quiz) return null
  const answered = picked !== null
  const ok = answered && quiz.options[picked].ok
  const cardOptions = quiz.options.some((o) => o.card)

  const answer = (i: number) => {
    if (answered) return
    setPicked(i)
    const right = quiz.options[i].ok
    setSession((s) => ({ right: s.right + (right ? 1 : 0), total: s.total + 1, streak: right ? s.streak + 1 : 0 }))
    onAnswer(right)
  }
  const next = () => {
    setPicked(null)
    setQuiz(MAKERS[id]())
  }

  return (
    <div className="animate-fade-in space-y-3 pt-3 pb-8">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="-ml-2 gap-1 px-2" onClick={onClose}>
          <ChevronLeft className="h-4 w-4" />
          Volver
        </Button>
        <div className="min-w-0 flex-1 truncate text-right text-xs text-muted-foreground">{QUIZ_TITLES[id]}</div>
      </div>
      <Card>
        <CardContent className="space-y-4 pt-5">
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>
              Aciertos <b className="text-foreground tabular-nums">{session.right}/{session.total}</b>
            </span>
            <span>
              Racha <b className="text-foreground tabular-nums">{session.streak}</b>
            </span>
          </div>
          <p className="text-lg leading-snug">
            <Rich text={quiz.prompt} />
          </p>
          {quiz.cards && (
            <div className="flex justify-center gap-2">
              {quiz.cards.map((c) => (
                <SpanishCard key={`${c.num}-${c.suit}`} card={c} size="lg" />
              ))}
            </div>
          )}
          <div className={cn("grid gap-3", cardOptions ? "grid-cols-3 items-center" : "grid-cols-2")}>
            {quiz.options.map((o, i) => (
              <AnswerButton
                key={i}
                tone={answerTone(answered, { correct: o.ok, picked: picked === i })}
                onClick={() => answer(i)}
                className={cn(o.card && "flex h-auto items-center justify-center py-2")}
                aria-label={o.card ? `${o.card.num} de ${o.card.suit}` : o.label}
              >
                {o.card ? <SpanishCard card={o.card} size="lg" /> : o.label}
              </AnswerButton>
            ))}
          </div>
          {answered && (
            <div className="animate-fade-in space-y-3">
              <p
                className={cn(
                  "rounded-xl px-3 py-2 text-sm",
                  ok ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200" : "bg-rose-500/15 text-rose-700 dark:text-rose-200",
                )}
              >
                <b>{ok ? "¡Bien!" : "No."}</b> {quiz.explain}
              </p>
              <Button className="w-full" size="lg" onClick={next}>
                Otra
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function Practicar() {
  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const players = useMemo(
    () => allPlayers.filter((p) => !HIDDEN_TRAINEES.includes(p.name.trim().toLowerCase())),
    [allPlayers],
  )
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [progress, setProgress] = useState<TrucoProgress | null>(null)
  const [pickOpen, setPickOpen] = useState(false)
  const [open, setOpen] = useState<TrucoQuizId | null>(null)
  /** Sesión de Truco (TRUCO_PIN): no ve a nadie más; solo su jugador. */
  const [alone, setAlone] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let saved: string | null = null
    try {
      saved = localStorage.getItem(PLAYER_KEY)
      setPlayerId(saved)
    } catch {}
    db.getSessionRole()
      .then(async (role) => {
        if (role === "truco") {
          setAlone(true)
          // Solo el jugador de este celular (si es de Truco; si no, se olvida).
          const me = saved ? await db.getTrucoPlayer(saved) : null
          setAllPlayers(me ? [me] : [])
        } else {
          setAllPlayers(await db.getTrucoPlayers())
        }
        setLoaded(true)
      })
      .catch(() => {}) // sin señal: se practica igual, sin guardar
  }, [])

  const changePlayer = (id: string | null) => {
    setPlayerId(id)
    setProgress(null)
    try {
      if (id) localStorage.setItem(PLAYER_KEY, id)
      else localStorage.removeItem(PLAYER_KEY)
    } catch {}
  }

  // Si el jugador guardado ya no existe (se borró) o esta sesión no lo puede usar, olvidarlo.
  useEffect(() => {
    if (playerId && loaded && (alone || allPlayers.length > 0) && !allPlayers.some((p) => p.id === playerId))
      changePlayer(null)
  }, [allPlayers, playerId, loaded, alone])

  useEffect(() => {
    if (!playerId) return
    let cancelled = false
    db.getTrucoProgress(playerId, getTodayLocalDate())
      .then((p) => !cancelled && setProgress(p))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [playerId])

  // Cada respuesta se guarda (si hay jugador) y se suma al progreso en pantalla
  // sin esperar a la base. Si falla por falta de señal, se pierde esa respuesta.
  const onAnswer = useCallback(
    (quiz: TrucoQuizId, correct: boolean) => {
      if (!playerId) return
      const today = getTodayLocalDate()
      db.recordTrucoAnswer({ playerId, quiz, correct, localDate: today }).catch(() => {})
      setProgress((p) => {
        if (!p) return p
        const t = p.byQuiz[quiz] ?? { right: 0, total: 0 }
        return {
          byQuiz: { ...p.byQuiz, [quiz]: { right: t.right + (correct ? 1 : 0), total: t.total + 1 } },
          days: p.days.includes(today) ? p.days : [today, ...p.days],
          today: { right: p.today.right + (correct ? 1 : 0), total: p.today.total + 1 },
        }
      })
    },
    [playerId],
  )

  const close = useCallback(() => setOpen(null), [])
  useBackToClose(open !== null, close, "truco-practica")

  const drawer = (
    <PlayerDrawer
      open={pickOpen}
      onOpenChange={setPickOpen}
      players={players}
      value={playerId}
      onChange={changePlayer}
      alone={alone}
      onCreate={async (name) => {
        const p = await db.createTrucoPlayer(name)
        setAllPlayers(alone ? [p] : await db.getTrucoPlayers())
        return p
      }}
    />
  )

  if (open) {
    return (
      <>
        {drawer}
        <QuizScreen id={open} onClose={close} onAnswer={(c) => onAnswer(open, c)} />
      </>
    )
  }

  const player = players.find((p) => p.id === playerId)
  return (
    <div className="space-y-3 pt-4 pb-8">
      {drawer}
      <TrainerCard player={player} progress={progress} onPick={() => setPickOpen(true)} />
      {TRUCO_QUIZ_IDS.map((id) => {
        const t = progress?.byQuiz[id]
        return (
          <button
            key={id}
            onClick={() => setOpen(id)}
            className="flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left transition-colors active:bg-muted"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{QUIZ_TITLES[id]}</span>
              <span className="block text-sm text-muted-foreground">{QUIZ_DESC[id]}</span>
            </span>
            {t && t.total > 0 && (
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {t.right}/{t.total}
              </span>
            )}
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </button>
        )
      })}
      {!player && (
        <p className="px-1 text-xs text-muted-foreground">
          Podés practicar igual sin elegir tu nombre; solo que no se guarda tu progreso.
        </p>
      )}
    </div>
  )
}
