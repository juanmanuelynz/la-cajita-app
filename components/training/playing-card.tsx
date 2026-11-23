import { RANK_LABELS, SUITS, rankOf, suitOf, type Card } from "@/lib/poker/cards"
import { cn } from "@/lib/utils"

// Mazo de 2 colores, como el de la mesa: ♠ y ♣ negros, ♥ y ♦ coral (el mismo
// coral que usan las cartas del resto de la app, SUIT_RED).
export const SUIT_RED = "text-[#e0564b]"
export const SUIT_TEXT = ["text-zinc-900", SUIT_RED, SUIT_RED, "text-zinc-900"] as const

const SIZES = {
  xs: "w-7 h-10 text-[11px] rounded-[5px]",
  sm: "w-9 h-[52px] text-sm rounded-[7px]",
  md: "w-11 h-16 text-base rounded-[8px]",
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
        "relative bg-stone-100 border border-black/10 shadow-[0_2px_0_0_rgb(0_0_0/0.35)] flex flex-col items-center justify-center font-bold leading-none select-none transition-all",
        SIZES[size],
        SUIT_TEXT[suit],
        highlight && "ring-2 ring-amber-400 -translate-y-1",
        dim && "opacity-35",
        className,
      )}
      aria-label={`${RANK_LABELS[rankOf(card)]}${SUITS[suit]}`}
    >
      <span>{RANK_LABELS[rankOf(card)]}</span>
      <span className={size === "xs" ? "text-[11px]" : "text-lg"}>{SUITS[suit]}</span>
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
