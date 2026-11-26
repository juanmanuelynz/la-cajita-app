"use client"

// Mesa de poker minimalista, como en las apps de entrenamiento: un óvalo
// vertical con paño oscuro y una línea fina de borde, las cartas comunitarias
// en el centro y cada jugador con su cartelito apoyado sobre el borde. Vos
// siempre abajo (resaltado); el rival arriba.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { Check } from "lucide-react"
import { CHIP_COLORS, PokerChip } from "@/components/poker-chip"
import type { Card } from "@/lib/poker/cards"
import { cn } from "@/lib/utils"
import { CardBack, CardRow, type CardSize } from "./playing-card"
import { ringLayout, type Layout } from "./ring-layout"

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
  /** Apuesta de este jugador: ficha con el monto sobre el paño, del lado del centro. */
  bet?: string
  /** Si se pasa, el lugar es un botón para elegirlo (¿Quién gana?, ¿Cuál es mejor?). */
  pick?: { onPick: () => void; answered: boolean; correct: boolean; picked: boolean }
}

function SeatView({ seat, side, compact }: { seat: TableSeat; side: "top" | "bottom"; compact: boolean }) {
  const { pick } = seat
  const good = !!pick?.answered && pick.correct
  const wrong = !!pick?.answered && pick.picked && !pick.correct
  // Con 4–5 cartas (Omaha, Manhattan) van solapadas y grandes: así ocupan
  // menos que chicas en fila.
  const overlap = seat.cards.length >= 4
  const size: CardSize = overlap || (seat.hero && !compact) ? "md" : "sm"

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
      {seat.bet && <BetChip amount={seat.bet} className="my-1" />}
      <CardRow
        cards={seat.cards}
        size={size}
        used={seat.used}
        deal={seat.deal}
        overlap={overlap}
        className="flex-nowrap justify-center"
      />
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

/** Pozo en el centro de la mesa redonda: cartelito como los de los lugares. */
export function PotPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border bg-background/80 px-2.5 py-0.5 text-xs font-semibold text-amber-300 tabular-nums">
      {children}
    </span>
  )
}

/** Dato para el centro de la mesa (pozo, etc.). */
export function TableChip({ children }: { children: ReactNode }) {
  return <span className="font-semibold normal-case tracking-normal text-amber-300">{children}</span>
}

/** Ficha chiquita con el monto, apoyada en el paño (una apuesta). */
export function BetChip({ amount, className, style }: { amount?: string; className?: string; style?: CSSProperties }) {
  return (
    <span style={style} className={cn("inline-flex items-center gap-1 text-[11px] font-bold tabular-nums text-amber-300", className)}>
      <PokerChip className="h-4 w-4 drop-shadow" body={CHIP_COLORS[4].body} edge={CHIP_COLORS[4].edge} />
      {amount}
    </span>
  )
}

/** Botón del que reparte. */
function DealerButton() {
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[10px] font-black text-black shadow"
      aria-label="Reparte"
    >
      D
    </span>
  )
}

export interface RingSeat {
  key: string | number
  /** "1º", "Reparte", "Ciega chica"… */
  label: string
  /** Tu lugar: tus cartas boca arriba y cartelito verde. */
  hero?: boolean
  /** Tus cartas; en otro lugar, sus cartas boca arriba (la mano del que apostó). */
  cards?: readonly Card[]
  /** Repartir sus cartas con animación a partir de estos ms. */
  deal?: number
  /** Lo que hizo antes que vos. "fold" lo apaga; "bet" lo marca como el que apostó. */
  action?: { kind: "check" | "fold" | "bet" | "blind"; text: string }
  /** Ficha sobre el paño, delante del lugar (con el monto, si hay). */
  chip?: string | true
  dealer?: boolean
}

/** Para medir sin parpadeo antes de pintar (en el servidor no hace falta). */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

/**
 * Mesa con todos los lugares alrededor del óvalo, en el orden en que se habla
 * (sentido de las agujas del reloj, hacia la izquierda). Vos siempre abajo; el
 * resto se reparte por el borde. `center` va en el medio del paño (pozo, la
 * mano del rival). Cada lugar es un bloque (ficha, cartas, cartelito con el
 * botón, jugada) que se mide en el navegador: `ringLayout` los ubica sin que
 * nada se pise, agrandando la mesa si hace falta.
 */
export function RingTable({
  seats,
  center,
  heroCardSize = "md",
}: {
  seats: RingSeat[]
  center?: ReactNode
  /** Tamaño de tus cartas (más chicas si además hay mesa y manos de 4–5). */
  heroCardSize?: "sm" | "md"
}) {
  const h = Math.max(0, seats.findIndex((s) => s.hero))
  const rootRef = useRef<HTMLDivElement>(null)
  const seatRefs = useRef<(HTMLDivElement | null)[]>([])
  const centerRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<Layout | null>(null)
  // Si alguno tiene ficha, todos le guardan el lugar: así no se mueven al apostar.
  const anyChip = seats.some((s) => s.chip)

  const measure = useCallback(() => {
    const root = rootRef.current
    if (!root) return
    const width = root.clientWidth
    const boxes = seats.map((_, i) => {
      const el = seatRefs.current[i]
      return { w: el?.offsetWidth ?? 0, h: el?.offsetHeight ?? 0 }
    })
    const c = centerRef.current
    const next = ringLayout(width, boxes, h, c ? { w: c.offsetWidth, h: c.offsetHeight } : null)
    setLayout((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
  }, [seats, h])

  useIsoLayoutEffect(() => {
    measure()
  })
  // Cambios de ancho o de tamaño (fuentes que cargan, cartas que aparecen).
  useEffect(() => {
    const root = rootRef.current
    if (!root || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(() => measure())
    ro.observe(root)
    seatRefs.current.forEach((el) => el && ro.observe(el))
    if (centerRef.current) ro.observe(centerRef.current)
    return () => ro.disconnect()
  }, [measure])

  const pos = (i: number): CSSProperties =>
    layout?.seats[i]
      ? { left: layout.seats[i].x, top: layout.seats[i].y, transform: "translate(-50%, -50%)" }
      : { left: 0, top: 0, visibility: "hidden" }

  return (
    <div ref={rootRef} className="relative mx-auto w-full max-w-[380px]" style={{ height: layout?.height ?? 340 }}>
      {/* El paño */}
      {layout && (
        <div
          className={cn(
            "absolute rounded-[50%] border border-primary/45",
            "bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--primary)_14%,var(--background)),var(--background)_75%)]",
            "outline outline-1 -outline-offset-[10px] outline-primary/15",
          )}
          style={{
            left: layout.felt.x - layout.felt.rx,
            width: layout.felt.rx * 2,
            top: Math.max(0, layout.felt.y - layout.felt.ry),
            height: Math.min(layout.height, layout.felt.y + layout.felt.ry) - Math.max(0, layout.felt.y - layout.felt.ry),
          }}
        />
      )}
      {center && (
        <div
          ref={centerRef}
          className="absolute z-10 flex flex-col items-center gap-2"
          style={
            layout?.center
              ? { left: layout.center.x, top: layout.center.y, transform: "translate(-50%, -50%)" }
              : { left: 0, top: 0, visibility: "hidden" }
          }
        >
          {center}
        </div>
      )}

      {seats.map((s, i) => {
        const folded = s.action?.kind === "fold"
        const bettor = s.action?.kind === "bet"
        // La ficha va del lado del centro: arriba en los lugares de abajo (y en el tuyo), abajo en el resto.
        const lower = s.hero || (layout ? layout.seats[i].y > (layout.center?.y ?? layout.felt.y) : false)
        const chip = anyChip && (
          <BetChip
            amount={s.chip === true ? undefined : s.chip}
            className={cn("whitespace-nowrap", !s.chip && "invisible")}
            // Lugar guardado aunque no tenga ficha.
            style={s.chip ? undefined : { minHeight: 16 }}
          />
        )
        return (
          <div
            key={s.key}
            ref={(el) => {
              seatRefs.current[i] = el
            }}
            style={pos(i)}
            className="absolute z-10 flex flex-col items-center gap-1"
          >
            {lower && chip}
            {s.hero ? (
              s.cards && (
                <CardRow
                  cards={s.cards}
                  size={heroCardSize}
                  overlap={s.cards.length >= 4}
                  deal={0}
                  className="flex-nowrap justify-center"
                />
              )
            ) : s.cards ? (
              <CardRow
                cards={s.cards}
                size="sm"
                overlap={s.cards.length >= 4}
                deal={s.deal}
                className={cn("flex-nowrap justify-center", folded && "opacity-40")}
              />
            ) : (
              // Al irse quedan sin cartas, pero el hueco se guarda para que no se corra nada.
              <div className={cn("flex -space-x-2", folded && "invisible")}>
                <CardBack size="mini" className="-rotate-6" />
                <CardBack size="mini" className="rotate-6" />
              </div>
            )}
            <div className={cn("flex items-center gap-1", folded && "opacity-40")}>
              <div
                className={cn(
                  "whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] leading-4",
                  s.hero
                    ? "border-primary bg-primary font-semibold text-primary-foreground"
                    : "bg-background font-medium",
                  !s.hero && bettor && "border-rose-500 text-rose-400",
                )}
              >
                {s.hero ? `Vos · ${s.label}` : s.label}
              </div>
              {s.dealer && <DealerButton />}
            </div>
            {!s.hero && (
              <div
                className={cn(
                  "min-h-3 whitespace-nowrap rounded px-1 text-[10px] font-semibold uppercase leading-3 tracking-wide",
                  bettor ? "bg-rose-500 text-white" : "text-muted-foreground",
                  folded && "line-through opacity-40",
                )}
              >
                {s.action?.text}
              </div>
            )}
            {!lower && chip}
          </div>
        )
      })}
    </div>
  )
}
