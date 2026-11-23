import { RANK_LABELS, SUITS, rankOf, suitOf, type Card } from "@/lib/poker/cards"
import { cn } from "@/lib/utils"

// Mazo de 4 colores (♠ negro, ♥ rojo, ♦ azul, ♣ verde): con cartas chicas se
// distinguen los palos de un vistazo, que es justo lo que importa para leer
// colores. Es la opción habitual en las salas online.
export const SUIT_TEXT = ["text-slate-900", "text-red-600", "text-blue-600", "text-green-700"] as const

const SIZES = {
  xs: "w-7 h-10 text-[11px] rounded",
  sm: "w-9 h-[52px] text-sm rounded-md",
  md: "w-11 h-16 text-base rounded-md",
} as const

export type CardSize = keyof typeof SIZES

export function PlayingCard({
  card,
  size = "md",
  highlight,
  dim,
  className,
}: {
  card: Card
  size?: CardSize
  /** Resalta la carta (forma parte de la mano). */
  highlight?: boolean
  /** Atenúa la carta (no se usa). */
  dim?: boolean
  className?: string
}) {
  const suit = suitOf(card)
  return (
    <div
      className={cn(
        "relative bg-white border border-slate-300 shadow-sm flex flex-col items-center justify-center font-bold leading-none select-none transition-all",
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
}: {
  cards: readonly Card[]
  size?: CardSize
  /** Si se pasa, resalta estas cartas y atenúa el resto. */
  used?: readonly Card[]
  className?: string
}) {
  return (
    <div className={cn("flex gap-1 flex-wrap", className)}>
      {cards.map((c) => (
        <PlayingCard key={c} card={c} size={size} highlight={used?.includes(c)} dim={used ? !used.includes(c) : false} />
      ))}
    </div>
  )
}
