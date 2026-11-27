// Las cuatro bravas (ancho de espada, ancho de basto, siete de espada, siete de
// oro) en abanico, con el dorso atrás. Lo usan la presentación de Truco en
// Ajustes y el splash de Truco (`animated`: se abren al aparecer).

import type { CSSProperties } from "react"
import type { TrucoCard } from "@/lib/truco/engine"
import { cn } from "@/lib/utils"
import { SpanishCard, SpanishCardBack } from "./spanish-card"

const BRAVAS: TrucoCard[] = [
  { num: 1, suit: "espada" },
  { num: 1, suit: "basto" },
  { num: 7, suit: "espada" },
  { num: 7, suit: "oro" },
]

/** Colores del dorso de Truco, por si se usa fuera de /truco (Poker no tiene la clase .truco). */
const TRUCO_BACK = {
  "--back-from": "#2f62ad",
  "--back-to": "#16325e",
  "--back-glow": "rgb(110 160 240 / 0.45)",
  "--back-leaf": "#f3d27a",
} as CSSProperties

export function BravasFan({
  animated = false,
  reversed = false,
  className,
}: {
  animated?: boolean
  /** Del 7 de oro al 1 de espada (el ancho de espada queda adelante, a la derecha). */
  reversed?: boolean
  className?: string
}) {
  const cards = reversed ? [...BRAVAS].reverse() : BRAVAS
  const place = (i: number) =>
    ({
      "--fan": `translateX(${(i - 1.5) * 26}px) rotate(${(i - 1.5) * 11}deg)`,
      transform: "var(--fan)",
      animationDelay: animated ? `${120 + i * 90}ms` : undefined,
    }) as CSSProperties
  return (
    <div style={TRUCO_BACK} className={cn("relative h-28 w-56", className)}>
      <SpanishCardBack size="lg" className="absolute bottom-0 left-1/2 -ml-8 origin-bottom -translate-x-10 -rotate-[34deg]" />
      {cards.map((c, i) => (
        <div
          key={`${c.num}-${c.suit}`}
          className={cn("absolute bottom-0 left-1/2 -ml-8 origin-bottom", animated && "animate-fan-open")}
          style={place(i)}
        >
          <SpanishCard card={c} size="lg" className="shadow-xl" />
        </div>
      ))}
    </div>
  )
}
