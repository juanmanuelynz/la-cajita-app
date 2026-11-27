"use client"

// Presentación de La Cajita Truco en Poker → Configuración → Ajustes, arriba de
// la tarjeta de ajustes. La "imagen" son las cuatro bravas en abanico sobre el
// paño azul de Truco (las cartas de la app, no una foto).

import Link from "next/link"
import type { CSSProperties } from "react"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { setLastApp } from "@/lib/last-app"
import { BravasFan } from "./bravas-fan"

export function TrucoPromo() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div
        style={{ "--back-from": "#2f62ad", "--back-to": "#16325e" } as CSSProperties}
        className="truco-felt relative flex h-40 items-end justify-center pb-3"
      >
        <BravasFan />
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
