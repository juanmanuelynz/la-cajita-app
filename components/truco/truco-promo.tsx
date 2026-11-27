"use client"

// Presentación de La Cajita Truco en Poker → Configuración → Ajustes, arriba de
// la tarjeta de ajustes. La "imagen" son las cuatro bravas en abanico sobre el
// paño azul de Truco (las cartas de la app, no una foto).

import Link from "next/link"
import type { CSSProperties } from "react"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { setLastApp } from "@/lib/last-app"
import type { TrucoCard } from "@/lib/truco/engine"
import { SpanishCard, SpanishCardBack } from "./spanish-card"

const BRAVAS: TrucoCard[] = [
  { num: 1, suit: "espada" },
  { num: 1, suit: "basto" },
  { num: 7, suit: "espada" },
  { num: 7, suit: "oro" },
]

/** Los colores del paño y del dorso de Truco (Poker no tiene la clase .truco). */
const TRUCO_FELT = {
  "--back-from": "#2f62ad",
  "--back-to": "#16325e",
  "--back-glow": "rgb(110 160 240 / 0.45)",
  "--back-leaf": "#f3d27a",
} as CSSProperties

export function TrucoPromo() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div style={TRUCO_FELT} className="truco-felt relative flex h-40 items-end justify-center pb-3">
        {/* Abanico: el dorso atrás y las cuatro bravas, de la más fuerte a la derecha. */}
        <div className="relative h-28 w-56">
          <SpanishCardBack size="lg" className="absolute bottom-0 left-1/2 -ml-8 origin-bottom -rotate-[34deg] -translate-x-10" />
          {BRAVAS.map((c, i) => (
            <div
              key={`${c.num}-${c.suit}`}
              className="absolute bottom-0 left-1/2 -ml-8 origin-bottom"
              style={{ transform: `translateX(${(i - 1.5) * 26}px) rotate(${(i - 1.5) * 11}deg)` }}
            >
              <SpanishCard card={c} size="lg" className="shadow-xl" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <p className="text-lg font-bold">La Cajita Truco</p>
          <p className="text-sm text-muted-foreground">
            Truco argentino mano a mano: aprendé las reglas, practicá, jugá contra la máquina y anotá tus partidas con
            fósforos.
          </p>
        </div>
        <Button asChild className="w-full">
          <Link href="/truco" onClick={() => setLastApp("truco")}>
            Quiero jugar Truco
            <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
