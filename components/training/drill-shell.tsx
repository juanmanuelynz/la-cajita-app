"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import { CheckCircle2, XCircle, Flame, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { playSound } from "@/lib/sounds"
import type { Variant } from "@/lib/poker/variants"
import { cn } from "@/lib/utils"

export type Verdict = "right" | "wrong" | "close"

/**
 * Estado común de un ejercicio: genera la situación (solo en el cliente, para
 * no romper la hidratación con cartas al azar), lleva aciertos y racha, y la
 * vuelve a generar al cambiar de juego.
 */
export function useDrill<T>(variant: Variant, make: (v: Variant) => T) {
  const [drill, setDrill] = useState<T | null>(null)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [score, setScore] = useState({ right: 0, total: 0, streak: 0 })

  const next = useCallback(() => {
    setDrill(make(variant))
    setVerdict(null)
  }, [make, variant])

  useEffect(() => {
    next()
  }, [next])

  const answer = useCallback((v: Verdict) => {
    setVerdict(v)
    const ok = v !== "wrong"
    setScore((s) => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1, streak: ok ? s.streak + 1 : 0 }))
    playSound(ok ? "chipLay" : "error")
  }, [])

  return { drill, verdict, score, answer, next }
}

export function DrillShell({
  title,
  question,
  score,
  verdict,
  onNext,
  children,
  feedback,
}: {
  title: string
  question: ReactNode
  score: { right: number; total: number; streak: number }
  verdict: Verdict | null
  onNext: () => void
  children: ReactNode
  feedback?: ReactNode
}) {
  return (
    <div className="pt-2 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
          <span>
            {score.right}/{score.total} bien
          </span>
          {score.streak >= 2 && (
            <span className="flex items-center gap-0.5 text-amber-500 font-semibold">
              <Flame className="w-3.5 h-3.5" />
              {score.streak}
            </span>
          )}
        </div>
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
          {feedback}
          <Button className="w-full mt-1" onClick={onNext}>
            Siguiente <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  )
}

export function Label({ children }: { children: ReactNode }) {
  return <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{children}</div>
}

export const pct = (x: number, digits = 1) =>
  `${(x * 100).toLocaleString("es-AR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`

export const pesos = (n: number) => `$${n.toLocaleString("es-AR")}`
