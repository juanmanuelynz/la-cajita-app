"use client"

// Mesa de poker minimalista, como en las apps de entrenamiento: un óvalo
// vertical con paño oscuro y una línea fina de borde, las cartas comunitarias
// en el centro y cada jugador con su cartelito apoyado sobre el borde. Vos
// siempre abajo (resaltado); el rival arriba.

import type { ReactNode } from "react"
import { Check } from "lucide-react"
import type { Card } from "@/lib/poker/cards"
import { cn } from "@/lib/utils"
import { CardRow, type CardSize } from "./playing-card"

export interface TableSeat {
  key: string | number
  name: string
  cards: readonly Card[]
  /** Tu lugar: cartas grandes y cartelito verde. */
  hero?: boolean
  /** Al lado del nombre (por ejemplo, la jugada que tiene). */
  detail?: ReactNode
  used?: readonly Card[]
  deal?: number
  /** Si se pasa, el lugar es un botón para elegirlo (¿Quién gana?, ¿Cuál es mejor?). */
  pick?: { onPick: () => void; answered: boolean; correct: boolean; picked: boolean }
}

function SeatView({ seat, side, compact }: { seat: TableSeat; side: "top" | "bottom"; compact: boolean }) {
  const { pick } = seat
  const good = !!pick?.answered && pick.correct
  const wrong = !!pick?.answered && pick.picked && !pick.correct
  // Con 5 cartas (Manhattan) las grandes se salen del óvalo.
  const size: CardSize = seat.hero && !compact && seat.cards.length < 5 ? "md" : "sm"

  const plate = (
    <div
      className={cn(
        "flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] leading-4",
        seat.hero ? "border-primary bg-primary font-semibold text-primary-foreground" : "border-border bg-background",
        good && "border-amber-400 bg-amber-400 font-semibold text-black",
        wrong && "border-rose-500 bg-rose-500 font-semibold text-white",
      )}
    >
      {pick && !pick.answered && <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-muted-foreground" />}
      {good && <Check className="h-3 w-3 shrink-0" strokeWidth={4} />}
      <span className="whitespace-nowrap">{seat.name}</span>
      {seat.detail && <span className="truncate opacity-75">· {seat.detail}</span>}
    </div>
  )
  const body = (
    <div className={cn("flex flex-col items-center gap-1.5", side === "top" && "flex-col-reverse")}>
      <CardRow cards={seat.cards} size={size} used={seat.used} deal={seat.deal} className="flex-nowrap justify-center" />
      {plate}
    </div>
  )

  if (!pick) return <div className="min-w-0">{body}</div>
  return (
    <button
      type="button"
      disabled={pick.answered}
      onClick={pick.onPick}
      className={cn(
        "min-w-0 rounded-xl transition-all",
        !pick.answered && "active:scale-[0.96]",
        pick.answered && !good && !wrong && "opacity-50",
      )}
    >
      {body}
    </button>
  )
}

/**
 * La mesa. `top` y `bottom` son los lugares de arriba y de abajo (hasta 2 de
 * cada lado), con el cartelito sobre el borde; `board` va en el centro y
 * `center` (pozo, aviso) arriba de las cartas.
 */
export function PokerTable({
  top = [],
  bottom = [],
  board = [],
  boardLabel,
  center,
}: {
  top?: TableSeat[]
  bottom?: TableSeat[]
  board?: readonly Card[]
  boardLabel?: string
  center?: ReactNode
}) {
  const row = (seats: TableSeat[], side: "top" | "bottom") => (
    <div
      className={cn(
        "relative z-10 flex min-h-6 gap-4",
        side === "top" ? "-mt-3 items-start" : "-mb-3 items-end",
        // Dos de un lado: bien separados, cada uno sobre la curva (con el de enfrente forman un triángulo).
        seats.length > 1 ? cn("-mx-2 justify-between", side === "top" ? "mt-3" : "mb-3") : "justify-center",
      )}
    >
      {seats.map((s) => (
        <SeatView key={s.key} seat={s} side={side} compact={seats.length > 1} />
      ))}
    </div>
  )

  return (
    <div className="px-1 py-3">
      <div
        className={cn(
          "relative mx-auto flex w-full max-w-[380px] flex-col justify-between rounded-[50%] border border-primary/45 px-6",
          top.length > 0 && bottom.length > 0 ? "min-h-[300px]" : "min-h-[220px]",
          "bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--primary)_14%,var(--background)),var(--background)_75%)]",
          // Segunda línea fina adentro, como el borde del paño.
          "outline outline-1 -outline-offset-[10px] outline-primary/15",
        )}
      >
        {row(top, "top")}
        <div className="flex flex-col items-center gap-2 py-3">
          {(boardLabel || center) && (
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              {boardLabel}
              {center}
            </div>
          )}
          {board.length > 0 && <CardRow cards={board} deal={0} className="flex-nowrap justify-center" />}
        </div>
        {row(bottom, "bottom")}
      </div>
    </div>
  )
}

/** Dato para el centro de la mesa (pozo, etc.). */
export function TableChip({ children }: { children: ReactNode }) {
  return <span className="font-semibold normal-case tracking-normal text-amber-300">{children}</span>
}
