"use client"

// Presentación de La Cajita Poker en Truco → Ajustes, arriba de los ajustes:
// la vuelta de la presentación de Truco que tiene Poker. La "imagen" son los
// cuatro ases en abanico sobre el paño verde, con el dorso de La Cajita atrás.

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CardBack, PlayingCard } from "@/components/training/playing-card"
import { setLastApp } from "@/lib/last-app"
import { cn } from "@/lib/utils"

/** Los ases (♠ ♥ ♦ ♣): carta = (valor − 2) × 4 + palo. */
const ACES = [0, 1, 2, 3].map((suit) => 12 * 4 + suit)

/** Abanico de los cuatro ases (escalado: la carta de Entrenar más grande es chica para esto). */
function AcesFan({ className }: { className?: string }) {
  return (
    <div className={cn("relative h-28 w-56 translate-x-3", className)}>
      <div className="absolute bottom-0 left-1/2 -ml-8 origin-bottom -translate-x-10 -rotate-[34deg]">
        <CardBack size="md" className="origin-bottom-left scale-[1.45]" />
      </div>
      {ACES.map((card, i) => (
        <div
          key={card}
          className="absolute bottom-0 left-1/2 -ml-8 origin-bottom"
          style={{ transform: `translateX(${(i - 1.5) * 26}px) rotate(${(i - 1.5) * 11}deg)` }}
        >
          <PlayingCard card={card} size="md" className="origin-bottom-left scale-[1.45] shadow-xl" />
        </div>
      ))}
    </div>
  )
}

export function PokerPromo() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="relative flex h-40 items-center justify-center bg-[radial-gradient(ellipse_at_50%_40%,#1f9a6b,#063d2b_85%)] pb-2 shadow-[inset_0_0_30px_rgb(0_0_0/0.35)]">
        <AcesFan />
      </div>
      <div className="space-y-3 p-4">
        <div>
          <p className="text-lg font-bold">La Cajita Poker</p>
          <p className="text-sm text-muted-foreground">
            Torneos, partidas, ranking y estadísticas del grupo, y Entrenar para mejorar tu juego.
          </p>
        </div>
        <Button asChild className="w-full">
          <Link href="/" onClick={() => setLastApp("poker")}>
            Quiero jugar Poker
            <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
