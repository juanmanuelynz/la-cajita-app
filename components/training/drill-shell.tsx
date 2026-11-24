"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode, type Ref } from "react"
import { Check, X, Equal, Flame, ChevronDown } from "lucide-react"
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
  const endRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const [sheetH, setSheetH] = useState(0)
  const scrolled = useRef(false)

  // Medir el panel (cambia al abrir "Ver por qué").
  useEffect(() => {
    if (!verdict) {
      setSheetH(0)
      scrolled.current = false
      return
    }
    const el = sheetRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setSheetH(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [verdict])

  // Al responder, que los botones queden a la vista justo arriba del panel.
  useEffect(() => {
    if (!verdict || !sheetH || scrolled.current) return
    scrolled.current = true
    const end = endRef.current
    if (!end) return
    const parent = scrollParent(end)
    const viewBottom = parent ? parent.getBoundingClientRect().bottom : window.innerHeight
    const delta = end.getBoundingClientRect().bottom - (viewBottom - sheetH - 12)
    if (delta <= 0) return
    if (parent) parent.scrollBy({ top: delta, behavior: "smooth" })
    else window.scrollBy({ top: delta, behavior: "smooth" })
  }, [verdict, sheetH])

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

      <div ref={endRef} />
      {verdict && (
        <AnswerSheet
          ref={sheetRef}
          verdict={verdict}
          headline={headline}
          feedback={feedback}
          nextLabel={nextLabel}
          onNext={onNext}
        />
      )}
    </div>
  )
}

/** Busca el contenedor que scrollea (la pestaña), o null si es la ventana. */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY
    if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight) return p
  }
  return null
}

const VERDICT_TEXT: Record<Verdict, string> = { right: "¡Bien!", wrong: "No era", close: "Muy justo: las dos valen" }

/**
 * La respuesta, en un panel pegado abajo de la pestaña (sticky, arriba de la
 * barra de pestañas, que queda a mano): veredicto, el dato clave y la
 * explicación plegada en "Ver por qué". Al ir dentro de la pestaña, si cambiás
 * de pestaña no queda flotando encima de otra.
 */
function AnswerSheet({
  ref,
  verdict,
  headline,
  feedback,
  nextLabel,
  onNext,
}: {
  ref: Ref<HTMLDivElement>
  verdict: Verdict
  headline?: ReactNode
  feedback?: ReactNode
  nextLabel: string
  onNext: () => void
}) {
  const [why, setWhy] = useState(false)
  const Icon = verdict === "right" ? Check : verdict === "wrong" ? X : Equal
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={VERDICT_TEXT[verdict]}
      className="answer-sheet sticky bottom-0 z-30 -mx-1 flex max-h-[65dvh] flex-col rounded-t-3xl border-x border-t bg-background shadow-[0_-12px_32px_rgba(0,0,0,0.55)]"
    >
      <div className="overflow-y-auto px-4 pt-2 space-y-3 text-sm">
        <div className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/40" />
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-black",
              verdict === "right" ? "bg-emerald-500" : verdict === "wrong" ? "bg-rose-500" : "bg-amber-400",
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={3} />
          </div>
          <div className="text-lg font-semibold">{VERDICT_TEXT[verdict]}</div>
        </div>
        {headline && <div>{headline}</div>}
        {feedback && (
          <>
            <button
              type="button"
              onClick={() => setWhy((w) => !w)}
              aria-expanded={why}
              className="flex items-center gap-1 text-muted-foreground"
            >
              {why ? "Ocultar" : "Ver por qué"}
              <ChevronDown className={cn("h-4 w-4 transition-transform", why && "rotate-180")} />
            </button>
            {why && <div className="pb-1">{feedback}</div>}
          </>
        )}
      </div>
      <div className="px-4 pt-3 pb-3">
        <button
          type="button"
          onClick={onNext}
          className="h-12 w-full rounded-2xl bg-foreground text-base font-semibold text-background active:scale-[0.98] transition-transform"
        >
          {nextLabel}
        </button>
      </div>
    </div>
  )
}

export type AnswerTone = "idle" | "right" | "wrong" | "close" | "dim"

/**
 * Cómo se ve cada opción al responder: la correcta se prende en verde, la que
 * elegiste mal en rojo y el resto se apaga. Con `close` (las dos valen) se
 * prende en dorado la que elegiste.
 */
export function answerTone(
  answered: boolean,
  { correct, picked, close = false }: { correct: boolean; picked: boolean; close?: boolean },
): AnswerTone {
  if (!answered) return "idle"
  if (close) return picked ? "close" : "dim"
  if (correct) return "right"
  return picked ? "wrong" : "dim"
}

const TONE_BUTTON: Record<AnswerTone, string> = {
  idle: "border-border bg-card active:scale-[0.97] active:bg-muted",
  right:
    "border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 shadow-[0_0_22px_-2px_rgba(16,185,129,0.6)]",
  wrong: "border-rose-500 bg-rose-500/15 text-rose-600 dark:text-rose-300 shadow-[0_0_22px_-2px_rgba(244,63,94,0.55)]",
  close: "border-amber-400 bg-amber-400/15 text-amber-600 dark:text-amber-200 shadow-[0_0_22px_-2px_rgba(251,191,36,0.5)]",
  dim: "border-border bg-card opacity-40",
}

const TONE_PILL: Record<AnswerTone, string> = {
  idle: "border-border text-muted-foreground",
  right: "border-emerald-500/70 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  wrong: "border-rose-500/70 bg-rose-500/10 text-rose-600 dark:text-rose-400",
  close: "border-amber-400/70 bg-amber-400/10 text-amber-600 dark:text-amber-300",
  dim: "border-border text-muted-foreground",
}

/** Monto promedio en múltiplos de $100 (la ficha más chica), con signo. */
export function evLabel(n: number): string {
  const r = Math.round(n / 100) * 100
  if (r === 0) return n === 0 ? pesos(0) : `≈ ${pesos(0)}`
  return `${r > 0 ? "+" : "−"}${pesos(Math.abs(r))}`
}

/**
 * Botón de respuesta de Entrenar (la misma pieza en todos los ejercicios). Con
 * `amount` muestra arriba, al responder, cuánto se gana o pierde en promedio
 * con esa opción (el lugar está reservado desde antes para que no salte nada).
 */
export function AnswerButton({
  tone,
  amount,
  className,
  children,
  ...props
}: { tone: AnswerTone; amount?: number } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const answered = tone !== "idle"
  const button = (
    <button
      type="button"
      disabled={answered}
      {...props}
      className={cn(
        "min-h-14 w-full rounded-2xl border-2 px-2 text-base font-semibold leading-tight transition-all duration-200",
        TONE_BUTTON[tone],
        className,
      )}
    >
      {children}
    </button>
  )
  if (amount === undefined) return button
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        aria-hidden={!answered}
        className={cn(
          "flex h-7 items-center rounded-lg border px-3 text-sm font-semibold tabular-nums transition-opacity duration-300",
          TONE_PILL[tone === "dim" ? "dim" : tone],
          !answered && "opacity-0",
          tone === "dim" && "opacity-60",
        )}
      >
        {evLabel(amount)}
      </div>
      {button}
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
