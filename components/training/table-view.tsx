"use client"

// Mesa de poker minimalista, como en las apps de entrenamiento: un óvalo
// vertical con paño oscuro y una línea fina de borde, las cartas comunitarias
// en el centro y cada jugador con su cartelito apoyado sobre el borde. Vos
// siempre abajo (resaltado); el rival arriba.

import type { CSSProperties, ReactNode } from "react"
import { Check } from "lucide-react"
import { CHIP_COLORS, PokerChip } from "@/components/poker-chip"
import type { Card } from "@/lib/poker/cards"
import { cn } from "@/lib/utils"
import { CardBack, CardRow, type CardSize } from "./playing-card"

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
function DealerButton({ style }: { style?: CSSProperties }) {
  return (
    <span
      style={style}
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[10px] font-black text-black shadow",
        style && "absolute z-10 -translate-x-1/2 -translate-y-1/2",
      )}
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

/**
 * Mesa con todos los lugares alrededor del óvalo, en el orden en que se habla
 * (sentido de las agujas del reloj, hacia la izquierda). Vos siempre abajo; el
 * resto se reparte por el borde dejando lugar para tus cartas. `center` va en
 * el medio del paño (pozo, la mano del rival).
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
  const n = seats.length
  const h = Math.max(0, seats.findIndex((s) => s.hero))
  const hero = seats[h]
  // Ángulos (0° = derecha, 90° = abajo). El resto ocupa el arco que deja libre el lugar de abajo.
  const GAP = 72
  const angleOf = (i: number) => {
    const k = (i - h + n) % n
    return 90 + GAP + ((k - 1) * (360 - 2 * GAP)) / Math.max(1, n - 2)
  }
  const at = (deg: number, r: number, margin = 13) => {
    const t = (deg * Math.PI) / 180
    // Un poco hacia adentro del borde y sin salirse de los costados (los cartelitos tienen ancho).
    const x = Math.min(100 - margin, Math.max(margin, 50 + 41 * r * Math.cos(t)))
    return { left: `${x}%`, top: `${50 + 40 * r * Math.sin(t)}%` }
  }
  // Un lugar con cartas boca arriba es más ancho: que no se salga de los costados.
  const cardsMargin = (count: number) => {
    const width = count >= 4 ? 36 + (count - 1) * 24 : count * 40
    return Math.max(13, ((width / 2 + 6) / 380) * 100)
  }
  const heroOverlap = (hero?.cards?.length ?? 0) >= 4

  return (
    <div className="relative mx-auto h-[340px] w-full max-w-[380px]">
      {/* El paño */}
      <div
        className={cn(
          "absolute inset-x-[5%] inset-y-[8%] rounded-[50%] border border-primary/45",
          "bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--primary)_14%,var(--background)),var(--background)_75%)]",
          "outline outline-1 -outline-offset-[10px] outline-primary/15",
        )}
      />
      {center && (
        <div className="absolute inset-x-[18%] top-[30%] bottom-[34%] z-10 flex flex-col items-center justify-center gap-2">
          {center}
        </div>
      )}

      {seats.map((s, i) => {
        if (s.hero) return null
        const deg = angleOf(i)
        const folded = s.action?.kind === "fold"
        const bettor = s.action?.kind === "bet"
        // Con cartas boca arriba la ficha va pegada a las cartas, del lado del centro
        // (medida sobre las cartas reales, así no las tapa aunque sean 4 o 5).
        // Los de la mitad de arriba la llevan abajo de su cartelito; los de los costados, al lado de las cartas.
        const rad = (deg * Math.PI) / 180
        const chipBeside =
          s.cards && s.chip ? (Math.sin(rad) < -0.5 ? "below" : Math.cos(rad) < 0 ? "right" : "left") : null
        const chip = s.chip && (
          <BetChip
            amount={s.chip === true ? undefined : s.chip}
            className={cn(
              "absolute z-10 whitespace-nowrap",
              chipBeside === "right" && "left-full top-1/2 ml-1.5 -translate-y-1/2",
              chipBeside === "left" && "right-full top-1/2 mr-1.5 -translate-y-1/2",
              chipBeside === "below" && "left-1/2 top-full mt-1.5 -translate-x-1/2",
              !chipBeside && "-translate-x-1/2 -translate-y-1/2",
            )}
            style={chipBeside ? undefined : at(deg, 0.6)}
          />
        )
        return (
          <div key={s.key}>
            <div
              style={at(deg, 1, s.cards ? cardsMargin(s.cards.length) : undefined)}
              className={cn(
                "absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 transition-opacity",
                folded && "opacity-40",
              )}
            >
              {s.cards && (
                <div className="relative">
                  <CardRow
                    cards={s.cards}
                    size="sm"
                    overlap={s.cards.length >= 4}
                    deal={s.deal}
                    className="flex-nowrap justify-center"
                  />
                  {(chipBeside === "right" || chipBeside === "left") && chip}
                </div>
              )}
              {!folded && !s.cards && (
                <div className="flex -space-x-2">
                  <CardBack size="mini" className="-rotate-6" />
                  <CardBack size="mini" className="rotate-6" />
                </div>
              )}
              <div
                className={cn(
                  "whitespace-nowrap rounded-full border bg-background px-2 py-0.5 text-[11px] font-medium leading-4",
                  bettor && "border-rose-500 text-rose-400",
                )}
              >
                {s.label}
              </div>
              {s.action && (
                <div
                  className={cn(
                    "rounded px-1 text-[10px] font-semibold uppercase leading-3 tracking-wide",
                    bettor ? "bg-rose-500 text-white" : "text-muted-foreground",
                    folded && "line-through",
                  )}
                >
                  {s.action.text}
                </div>
              )}
              {chipBeside === "below" && chip}
            </div>
            {!chipBeside && chip}
            {s.dealer && <DealerButton style={at(deg + 16, 0.72)} />}
          </div>
        )
      })}

      {hero && (
        <>
          <div className="absolute bottom-[1%] left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1.5">
            {hero.cards && (
              <CardRow cards={hero.cards} size={heroCardSize} overlap={heroOverlap} deal={0} className="flex-nowrap justify-center" />
            )}
            <div className="flex items-center gap-1">
              <div className="whitespace-nowrap rounded-full border border-primary bg-primary px-2 py-0.5 text-[11px] font-semibold leading-4 text-primary-foreground">
                Vos · {hero.label}
              </div>
              {hero.dealer && <DealerButton />}
            </div>
          </div>
          {hero.chip && (
            <BetChip
              amount={hero.chip === true ? undefined : hero.chip}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left: "68%", top: "66%" }}
            />
          )}
        </>
      )}
    </div>
  )
}
