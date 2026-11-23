"use client"

// Piezas comunes para mostrar una mano como en una mesa de verdad, vista desde
// tu silla: el rival arriba (apagado), la mesa en el medio (sobre el paño) y
// vos abajo (resaltado). Así queda claro de quién es cada carta.

import type { ReactNode } from "react"
import { Check, UserRound } from "lucide-react"
import type { Card } from "@/lib/poker/cards"
import { cn } from "@/lib/utils"
import { CardRow, type CardSize } from "./playing-card"

/** La mesa: las cartas comunitarias sobre el paño. */
export function Felt({
  cards,
  label = "Mesa",
  deal = 0,
  children,
}: {
  cards: readonly Card[]
  label?: string
  deal?: number
  children?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-primary/25 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--primary)_22%,transparent),color-mix(in_oklch,var(--primary)_8%,transparent))] px-3 pb-3 pt-2 shadow-[inset_0_2px_10px_rgb(0_0_0/0.35)]">
      <div className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/80">{label}</div>
      <CardRow cards={cards} deal={deal} className="justify-center" />
      {children}
    </div>
  )
}

/** Tu lugar (abajo, resaltado) o el del rival (arriba, apagado). */
export function Seat({
  who,
  cards,
  detail,
  deal,
  used,
  title,
}: {
  who: "hero" | "rival"
  cards: readonly Card[]
  /** A la derecha del título (por ejemplo, el nombre de la jugada). */
  detail?: ReactNode
  deal?: number
  used?: readonly Card[]
  title?: string
}) {
  const hero = who === "hero"
  const size: CardSize = hero ? "md" : "sm"
  return (
    <div
      className={cn(
        "rounded-2xl border p-2.5",
        hero ? "border-primary/60 bg-primary/10" : "border-border bg-muted/30",
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span
          className={cn(
            "flex items-center gap-1.5 text-sm font-semibold",
            hero ? "text-primary" : "text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full",
              hero ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            <UserRound className="h-3.5 w-3.5" />
          </span>
          {title ?? (hero ? "Tu mano" : "Rival")}
        </span>
        {detail && <span className="truncate text-xs text-muted-foreground">{detail}</span>}
      </div>
      <CardRow cards={cards} size={size} deal={deal} used={used} className={cn(!hero && "opacity-90")} />
    </div>
  )
}

/**
 * Una mano para elegir (¿Quién gana?, ¿Cuál es mejor?): se ve como botón, con
 * un circulito de selección. Al responder se pinta la correcta (dorado) y, si
 * erraste, la que elegiste (rojo).
 */
export function PickableHand({
  title,
  detail,
  onPick,
  answered,
  correct,
  picked,
  children,
}: {
  title: ReactNode
  detail?: ReactNode
  onPick: () => void
  answered: boolean
  correct: boolean
  picked: boolean
  children: ReactNode
}) {
  const wrong = answered && picked && !correct
  const good = answered && correct
  return (
    <button
      type="button"
      disabled={answered}
      onClick={onPick}
      className={cn(
        "w-full rounded-2xl border-2 bg-card p-2.5 text-left transition-all",
        !answered && "border-border shadow-[0_3px_0_0] shadow-border active:translate-y-0.5 active:shadow-none",
        good && "border-amber-400 bg-amber-400/10",
        wrong && "border-rose-500 bg-rose-500/10",
        answered && !good && !wrong && "border-border opacity-70",
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
              good ? "border-amber-400 bg-amber-400 text-black" : wrong ? "border-rose-500" : "border-muted-foreground/50",
            )}
          >
            {good && <Check className="h-3 w-3" strokeWidth={4} />}
          </span>
          {title}
        </span>
        {detail && <span className="truncate text-xs text-muted-foreground">{detail}</span>}
      </div>
      {children}
    </button>
  )
}
