import { RANK_LABELS, SUITS, rankOf, suitOf, type Card } from "@/lib/poker/cards"
import { cn } from "@/lib/utils"

// Mazo de 2 colores, como el de la mesa: ♠ y ♣ negros, ♥ y ♦ coral (el mismo
// coral que usan las cartas del resto de la app, SUIT_RED).
export const SUIT_RED = "text-[#e0564b]"
export const SUIT_TEXT = ["text-zinc-900", SUIT_RED, SUIT_RED, "text-zinc-900"] as const

const SIZES = {
  xs: "w-7 h-10 rounded-[5px]",
  sm: "w-9 h-[52px] rounded-[7px]",
  md: "w-11 h-16 rounded-[9px]",
} as const

// Valor arriba a la izquierda (tipografía condensada) y palo grande abajo.
const RANK_STYLE = {
  xs: "left-[3px] top-[2px] text-[15px]",
  sm: "left-[4px] top-[3px] text-[20px]",
  md: "left-[5px] top-[4px] text-[25px]",
} as const
const SUIT_STYLE = {
  xs: "right-[3px] bottom-[2px] text-[14px]",
  sm: "right-[4px] bottom-[3px] text-[19px]",
  md: "right-[5px] bottom-[4px] text-[24px]",
} as const

export type CardSize = keyof typeof SIZES

export function PlayingCard({
  card,
  size = "md",
  highlight,
  dim,
  className,
  dealDelay,
}: {
  card: Card
  size?: CardSize
  /** Resalta la carta (forma parte de la mano). */
  highlight?: boolean
  /** Atenúa la carta (no se usa). */
  dim?: boolean
  className?: string
  /** Si se pasa, la carta entra con la animación de reparto después de esos ms. */
  dealDelay?: number
}) {
  const suit = suitOf(card)
  return (
    <div
      style={dealDelay !== undefined ? { animationDelay: `${dealDelay}ms` } : undefined}
      className={cn(
        dealDelay !== undefined && "card-deal",
        "relative shrink-0 overflow-hidden select-none transition-all leading-none",
        // Cara blanca con un degradé gris suave, borde fino y sombra con relieve.
        "bg-[linear-gradient(135deg,#ffffff_0%,#f4f4f5_55%,#dcdce0_100%)] ring-1 ring-inset ring-black/10",
        "shadow-[0_3px_8px_-2px_rgb(0_0_0/0.55),inset_0_1px_0_rgb(255_255_255/0.9)]",
        SIZES[size],
        SUIT_TEXT[suit],
        highlight && "ring-2 ring-amber-400 -translate-y-1",
        dim && "opacity-35",
        className,
      )}
      aria-label={`${RANK_LABELS[rankOf(card)]}${SUITS[suit]}`}
    >
      <span
        className={cn("absolute font-semibold tracking-tight [font-family:var(--font-card),sans-serif]", RANK_STYLE[size])}
      >
        {RANK_LABELS[rankOf(card)]}
      </span>
      <span className={cn("absolute drop-shadow-[0_1px_0_rgb(0_0_0/0.15)]", SUIT_STYLE[size])}>{SUITS[suit]}</span>
    </div>
  )
}

/** Hueco vacío donde va una carta. */
export function EmptyCard({ size = "md", active, className }: { size?: CardSize; active?: boolean; className?: string }) {
  return (
    <div
      className={cn(
        "border-2 border-dashed flex items-center justify-center text-muted-foreground",
        SIZES[size],
        active ? "border-primary bg-primary/10" : "border-muted-foreground/30",
        className,
      )}
    >
      <span className="text-xs">?</span>
    </div>
  )
}

export function CardRow({
  cards,
  size = "md",
  used,
  className,
  deal,
}: {
  cards: readonly Card[]
  size?: CardSize
  /** Si se pasa, resalta estas cartas y atenúa el resto. */
  used?: readonly Card[]
  className?: string
  /** Repartir las cartas con animación, una tras otra, empezando a los `deal` ms. */
  deal?: number
}) {
  // La key con las cartas hace que una mano nueva se vuelva a repartir.
  return (
    <div key={cards.join("-")} className={cn("flex gap-1 flex-wrap [perspective:600px]", className)}>
      {cards.map((c, i) => (
        <PlayingCard
          key={c}
          card={c}
          size={size}
          highlight={used?.includes(c)}
          dim={used ? !used.includes(c) : false}
          dealDelay={deal !== undefined ? deal + i * 70 : undefined}
        />
      ))}
    </div>
  )
}
