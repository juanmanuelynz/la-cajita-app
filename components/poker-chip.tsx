import { useId } from "react"
import { cn } from "@/lib/utils"

// Ficha de poker en SVG. Dos variantes:
//  - <PokerChip>: a color, para celebraciones y decoración.
//  - <ChipSpinner>: monocromática (currentColor, con los detalles calados por
//    máscara) para reemplazar a los spinners — se ve bien sobre cualquier fondo.

const EDGE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]

export const CHIP_COLORS = [
  { body: "#10b981", edge: "#ecfdf5" }, // esmeralda (primary)
  { body: "#e11d48", edge: "#fff1f2" }, // rojo
  { body: "#1e293b", edge: "#f8fafc" }, // negro
  { body: "#2563eb", edge: "#eff6ff" }, // azul
  { body: "#eab308", edge: "#fefce8" }, // dorado
] as const

interface PokerChipProps {
  className?: string
  body?: string
  edge?: string
  suit?: string
  style?: React.CSSProperties
}

export function PokerChip({
  className,
  body = CHIP_COLORS[0].body,
  edge = CHIP_COLORS[0].edge,
  suit = "♠",
  style,
}: PokerChipProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden>
      <circle cx="50" cy="50" r="48" fill={body} />
      {EDGE_ANGLES.map((a) => (
        <rect
          key={a}
          x="44"
          y="2"
          width="12"
          height="15"
          rx="2"
          fill={edge}
          transform={`rotate(${a} 50 50)`}
        />
      ))}
      <circle cx="50" cy="50" r="31" fill="rgba(0,0,0,0.18)" />
      <circle
        cx="50"
        cy="50"
        r="28"
        fill="none"
        stroke={edge}
        strokeWidth="2.5"
        strokeDasharray="6 5"
      />
      <text
        x="50"
        y="51"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="30"
        fill={edge}
      >
        {suit}
      </text>
    </svg>
  )
}

/** Silueta de ficha en currentColor, sin animación. */
export function ChipGlyph({ className }: { className?: string }) {
  const maskId = useId()
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <defs>
        <mask id={maskId}>
          <rect width="100" height="100" fill="white" />
          {EDGE_ANGLES.map((a) => (
            <rect
              key={a}
              x="44"
              y="2"
              width="12"
              height="16"
              rx="2"
              fill="black"
              transform={`rotate(${a} 50 50)`}
            />
          ))}
          <circle cx="50" cy="50" r="28" fill="none" stroke="black" strokeWidth="7" />
        </mask>
      </defs>
      <circle cx="50" cy="50" r="48" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  )
}

/** Ficha que gira sobre su eje: reemplazo de los spinners de carga. */
export function ChipSpinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={cn("block shrink-0 [perspective:200px]", className)}
    >
      <ChipGlyph className="block h-full w-full animate-chip-flip" />
    </span>
  )
}
