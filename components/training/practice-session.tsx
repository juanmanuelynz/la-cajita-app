"use client"

import { useCallback, useContext, useEffect, useMemo, useState } from "react"
import { Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChipSpinner } from "@/components/poker-chip"
import { playSound } from "@/lib/sounds"
import { practiceSession, type DailyQuestion, type WeakSpot } from "@/lib/poker/training"
import { TrainingContext } from "./drill-shell"
import { QuestionSession } from "./daily-challenge"

/**
 * "Practicar lo que más fallo": 10 preguntas sacadas de tus puntos débiles (con
 * más chances el que más fallás). Al azar, no es igual para todos; cada
 * respuesta suma al progreso como cualquier ejercicio.
 */
export function PracticeSession({ spots, onExit }: { spots: WeakSpot[]; onExit: () => void }) {
  const parent = useContext(TrainingContext)
  const [round, setRound] = useState(0)
  const [questions, setQuestions] = useState<DailyQuestion[] | null>(null)
  const [answers, setAnswers] = useState<boolean[]>([])
  const [done, setDone] = useState(false)

  // Fuera del render: generar tarda un poco (simulaciones), como en el desafío.
  useEffect(() => {
    setQuestions(null)
    setAnswers([])
    setDone(false)
    const t = setTimeout(() => setQuestions(practiceSession(spots)), 50)
    return () => clearTimeout(t)
  }, [spots, round])

  const onAnswer = useCallback(
    (...args: Parameters<NonNullable<typeof parent.onAnswer>>) => {
      parent.onAnswer?.(...args)
      setAnswers((prev) => [...prev, args[2]])
    },
    [parent],
  )
  const ctx = useMemo(() => ({ onAnswer }), [onAnswer])

  if (!questions) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
        <ChipSpinner className="h-8 w-8" />
        Armando tu práctica…
      </div>
    )
  }

  if (done) {
    const right = answers.filter(Boolean).length
    return (
      <div className="animate-fade-in space-y-4 rounded-2xl border border-primary/40 bg-primary/5 p-4 text-center">
        <Target className="mx-auto h-8 w-8 text-primary" />
        <div>
          <div className="text-sm text-muted-foreground">Práctica terminada</div>
          <div className="text-4xl font-black tabular-nums">
            {right}/{answers.length}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {right >= answers.length * 0.8
            ? "¡Muy bien! Si seguís así, esto deja de ser un punto débil."
            : "Cada respuesta cuenta: tus puntos débiles se recalculan con lo que practicás."}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onExit}>
            Volver
          </Button>
          <Button onClick={() => setRound((r) => r + 1)}>Otra tanda</Button>
        </div>
      </div>
    )
  }

  return (
    <QuestionSession
      title="Lo que más fallás"
      icon={Target}
      accent="primary"
      questions={questions}
      answers={answers}
      startAt={0}
      ctx={ctx}
      onFinish={() => {
        setDone(true)
        playSound("jingleMatch")
      }}
      onExit={onExit}
    />
  )
}
