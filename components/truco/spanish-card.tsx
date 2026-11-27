// Carta de la baraja española (Truco): el mismo marco y sombra que la carta de
// Entrenar (CARD_FACE) y el dorso de La Cajita con la hojita, que en Truco
// toma el azul de la paleta (.truco en app/globals.css). Los palos se
// redibujaron en SVG a partir de los del artefacto "Truco argentino".

import { CARD_FACE, CARD_RANK_FONT } from "@/components/training/playing-card"
import { LeafMark } from "@/components/leaf-mark"
import type { Suit, TrucoCard } from "@/lib/truco/engine"
import { cn } from "@/lib/utils"

/** Color de cada palo (índice y dibujo). */
export const SUIT_COLOR: Record<Suit, string> = {
  oro: "#9c6a12",
  copa: "#9b2c1b",
  espada: "#24508f",
  basto: "#2d5c22",
}

/** El palo a color, centrado en un viewBox de 34×34. */
export function SuitPip({ suit, className }: { suit: Suit; className?: string }) {
  return (
    <svg viewBox="-17 -17 34 34" className={className} aria-hidden>
      {suit === "oro" && (
        <>
          <circle r="11" fill="#E8B23A" stroke="#9C6A12" strokeWidth="2" />
          <circle r="6" fill="none" stroke="#9C6A12" strokeWidth="1.5" />
          <circle r="2" fill="#9C6A12" />
        </>
      )}
      {suit === "copa" && (
        <>
          <path d="M-10-12h20c0 10-4 14-10 14s-10-4-10-14z" fill="#C8432F" stroke="#7E2416" strokeWidth="1.6" />
          <rect x="-2" y="2" width="4" height="6" fill="#C8432F" stroke="#7E2416" strokeWidth="1.4" />
          <path d="M-7 13c0-4 3-5 7-5s7 1 7 5z" fill="#C8432F" stroke="#7E2416" strokeWidth="1.4" />
        </>
      )}
      {suit === "espada" && (
        <>
          <path d="M0-16l3.5 4v15h-7v-15z" fill="#BCD0E8" stroke="#24508F" strokeWidth="1.6" />
          <rect x="-8" y="3" width="16" height="3" rx="1.5" fill="#24508F" />
          <rect x="-2" y="6" width="4" height="7" fill="#24508F" />
          <circle cy="15" r="2.6" fill="#24508F" />
        </>
      )}
      {suit === "basto" && (
        <>
          <path d="M-3 15l-3.5-24c0-6 13-6 13 0L3 15z" fill="#4E8A3E" stroke="#26511D" strokeWidth="1.6" />
          <circle cx="-4" cy="-4" r="1.8" fill="#26511D" />
          <circle cx="4" cy="2" r="1.8" fill="#26511D" />
          <circle cx="-2" cy="8" r="1.6" fill="#26511D" />
        </>
      )}
    </svg>
  )
}

const SIZES = {
  xs: "w-7 h-10 rounded-[5px]",
  sm: "w-9 h-[52px] rounded-[7px]",
  md: "w-11 h-16 rounded-[9px]",
  lg: "w-16 h-24 rounded-[10px]",
  xl: "w-20 h-[120px] rounded-[12px]",
} as const
export type SpanishCardSize = keyof typeof SIZES

const INDEX_STYLE = {
  xs: "left-[3px] top-[2px] text-[11px]",
  sm: "left-[4px] top-[3px] text-[14px]",
  md: "left-[5px] top-[4px] text-[17px]",
  lg: "left-[6px] top-[5px] text-[20px]",
  xl: "left-[8px] top-[6px] text-[24px]",
} as const
// Índice de abajo (girado), solo en las cartas grandes.
const INDEX_BOTTOM = {
  lg: "right-[6px] bottom-[5px] text-[20px]",
  xl: "right-[8px] bottom-[6px] text-[24px]",
} as const
const PIP_STYLE = {
  xs: "w-4 h-4 mt-2",
  sm: "w-5 h-5 mt-2",
  md: "w-7 h-7 mt-2",
  lg: "w-10 h-10",
  xl: "w-12 h-12",
} as const

const FIGURE: Record<number, string> = { 10: "Sota", 11: "Caballo", 12: "Rey" }

export function SpanishCard({
  card,
  size = "md",
  highlight,
  dim,
  className,
}: {
  card: TrucoCard
  size?: SpanishCardSize
  /** Resalta la carta (por ejemplo, la que ganó la baza). */
  highlight?: boolean
  /** Oscurece la carta (no cuenta). */
  dim?: boolean
  className?: string
}) {
  const big = size === "lg" || size === "xl"
  return (
    <div
      role="img"
      aria-label={`${card.num} de ${card.suit}`}
      className={cn(
        "relative flex shrink-0 select-none items-center justify-center overflow-hidden leading-none transition-all",
        CARD_FACE,
        SIZES[size],
        highlight && "ring-2 ring-primary -translate-y-1",
        dim && "brightness-[0.4]",
        className,
      )}
      style={{ color: SUIT_COLOR[card.suit] }}
    >
      {/* Filete del color del palo, como el marco de las cartas españolas. */}
      {big && <span aria-hidden className="absolute inset-[4px] rounded-[7px] border border-current opacity-30" />}
      <span className={cn("absolute", CARD_RANK_FONT, INDEX_STYLE[size])}>{card.num}</span>
      {big && (
        <span className={cn("absolute rotate-180", CARD_RANK_FONT, INDEX_BOTTOM[size as "lg" | "xl"])}>
          {card.num}
        </span>
      )}
      {/* El nombre de la figura va debajo del palo, en el centro (no choca con el índice de abajo). */}
      <span className="flex flex-col items-center gap-0.5">
        <SuitPip suit={card.suit} className={PIP_STYLE[size]} />
        {big && FIGURE[card.num] && <span className="font-serif text-[9px] italic">{FIGURE[card.num]}</span>}
      </span>
    </div>
  )
}

const BACK_PAD = { xs: "p-[3px]", sm: "p-[4px]", md: "p-[5px]", lg: "p-[6px]", xl: "p-[7px]" } as const
const FELT_RADIUS = { xs: "rounded-[3px]", sm: "rounded-[4px]", md: "rounded-[5px]", lg: "rounded-[6px]", xl: "rounded-[7px]" } as const
const LEAF_WIDTH = { xs: "w-[80%]", sm: "w-[66%]", md: "w-[56%]", lg: "w-[50%]", xl: "w-[48%]" } as const

/** Dorso de La Cajita para las cartas españolas (en Truco, azul con la hojita dorada). */
export function SpanishCardBack({ size = "md", className }: { size?: SpanishCardSize; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative shrink-0 select-none bg-[linear-gradient(135deg,#ffffff_0%,#f4f4f5_55%,#dcdce0_100%)] ring-1 ring-inset ring-black/10",
        "shadow-[0_2px_6px_-2px_rgb(0_0_0/0.6),inset_0_1px_0_rgb(255_255_255/0.9)]",
        SIZES[size],
        BACK_PAD[size],
        className,
      )}
    >
      <div className={cn("card-back-felt", FELT_RADIUS[size])}>
        <LeafMark className={LEAF_WIDTH[size]} />
      </div>
    </div>
  )
}
