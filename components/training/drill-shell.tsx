"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { CheckCircle2, XCircle, Flame, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { playSequence, playSound, type SoundName } from "@/lib/sounds"
import type { Variant } from "@/lib/poker/variants"
import type { DrillId } from "@/lib/poker/training"
import { cn } from "@/lib/utils"

export type Verdict = "right" | "wrong" | "close"

/** Lo que el ejercicio avisa hacia afuera (para guardar el progreso). */
export const TrainingContext = createContext<{
  onAnswer?: (drill: DrillId, variant: Variant, correct: boolean) => void
}>({})

/** Props comunes de los ejercicios. Con `preset` muestran una situación dada (Desafío del día). */
export interface DrillProps<T> {
  variant: Variant
  preset?: T
  onNext?: () => void
  nextLabel?: string
}

/**
 * Estado común de un ejercicio: genera la situación (solo en el cliente, para
 * no romper la hidratación con cartas al azar), lleva aciertos y racha, y la
 * vuelve a generar al cambiar de juego. Con `preset` usa esa situación y
 * "Siguiente" llama a `onNext`.
 */
export interface DrillScore {
  right: number
  total: number
  streak: number
  /** Racha recién alcanzada (3, 5, 10, 15…): muestra el cartelito. `at` lo re-dispara. */
  milestone?: { n: number; at: number }
}

/** Rachas que se festejan y con qué sonido. */
function streakSound(n: number): SoundName | null {
  if (n === 3) return "chipsStack"
  if (n === 5) return "chipsBurst"
  if (n >= 10 && n % 5 === 0) return "chipsPush"
  return null
}

export function useDrill<T>(id: DrillId, { variant, preset, onNext }: DrillProps<T>, make: (v: Variant) => T) {
  const [drill, setDrill] = useState<T | null>(preset ?? null)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [score, setScore] = useState<DrillScore>({ right: 0, total: 0, streak: 0 })
  const streakRef = useRef(0)
  const { onAnswer } = useContext(TrainingContext)

  // Cada mano nueva suena a cartas repartidas.
  useEffect(() => {
    if (!drill) return
    return playSequence([
      { name: "cardDeal", at: 0 },
      { name: "cardDeal", at: 0.09 },
      { name: "cardDeal", at: 0.18 },
    ])
  }, [drill])

  const next = useCallback(() => {
    setVerdict(null)
    if (onNext) onNext()
    else setDrill(make(variant))
  }, [make, variant, onNext])

  useEffect(() => {
    if (preset) return
    setDrill(make(variant))
    setVerdict(null)
  }, [make, variant, preset])

  const answer = useCallback(
    (v: Verdict) => {
      setVerdict(v)
      const ok = v !== "wrong"
      const streak = ok ? streakRef.current + 1 : 0
      streakRef.current = streak
      const big = ok ? streakSound(streak) : null
      setScore((s) => ({
        right: s.right + (ok ? 1 : 0),
        total: s.total + 1,
        streak,
        milestone: big ? { n: streak, at: Date.now() } : undefined,
      }))
      playSound(ok ? "chipLay" : "error")
      if (big) playSound(big, { delay: 0.25 })
      onAnswer?.(id, variant, ok)
    },
    [id, variant, onAnswer],
  )

  return { drill, verdict, score, answer, next, inChallenge: !!preset }
}

export function DrillShell({
  title,
  question,
  score,
  verdict,
  onNext,
  children,
  feedback,
  headline,
  nextLabel = "Siguiente",
}: {
  title: string
  question: ReactNode
  /** Sin score no se muestra el contador (en el Desafío lo lleva el desafío). */
  score?: DrillScore
  verdict: Verdict | null
  onNext: () => void
  children: ReactNode
  feedback?: ReactNode
  /** El dato clave de la respuesta, en grande, arriba de la explicación. */
  headline?: ReactNode
  nextLabel?: string
}) {
  return (
    <div className="relative pt-2 space-y-4">
      {score?.milestone && (
        <div
          key={score.milestone.at}
          className="streak-toast pointer-events-none absolute left-1/2 top-0 z-20 flex items-center gap-1.5 whitespace-nowrap rounded-full bg-amber-500 px-4 py-1.5 text-sm font-bold text-black shadow-lg"
        >
          <Flame className="h-4 w-4" />¡{score.milestone.n} seguidas!
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        {score && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
            <span>
              {score.right}/{score.total} bien
            </span>
            {score.streak >= 2 && (
              <span
                key={score.streak}
                className={cn(
                  "num-pop flex items-center gap-0.5 rounded-full px-2 py-0.5 font-bold",
                  score.streak >= 5 ? "bg-amber-500 text-black" : "bg-amber-500/20 text-amber-500",
                )}
              >
                <Flame className="w-3.5 h-3.5" />
                {score.streak}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="text-sm">{question}</div>

      {children}

      {verdict && (
        <div
          className={cn(
            "rounded-lg border p-3 space-y-2 text-sm",
            verdict === "wrong" ? "border-rose-500/50 bg-rose-500/10" : "border-emerald-500/50 bg-emerald-500/10",
          )}
        >
          <div className="flex items-center gap-2 font-semibold">
            {verdict === "wrong" ? (
              <XCircle className="w-4 h-4 text-rose-500" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            )}
            {verdict === "right" ? "¡Bien!" : verdict === "close" ? "Muy justo: las dos valen" : "No era esa"}
          </div>
          {headline && <div className="py-1">{headline}</div>}
          {feedback}
          <Button className="w-full mt-1" onClick={onNext}>
            {nextLabel} <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  )
}

/** Datos grandes lado a lado para el titular de la respuesta. */
export function Stats({ items }: { items: { label: string; value: string; tone?: "good" | "bad" | "neutral" }[] }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((it) => (
        <div key={it.label} className="rounded-lg bg-background/60 px-2 py-1.5 text-center">
          <div
            className={cn(
              "text-2xl font-black tabular-nums leading-tight",
              it.tone === "good" && "text-emerald-500",
              it.tone === "bad" && "text-rose-500",
            )}
          >
            {it.value}
          </div>
          <div className="text-[11px] text-muted-foreground">{it.label}</div>
        </div>
      ))}
    </div>
  )
}

export function Label({ children }: { children: ReactNode }) {
  return <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{children}</div>
}

export const pct = (x: number, digits = 1) =>
  `${(x * 100).toLocaleString("es-AR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`

export const pesos = (n: number) => `$${n.toLocaleString("es-AR")}`
