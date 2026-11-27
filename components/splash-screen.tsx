// Pantalla de carga de La Cajita: el ícono de la app (el mismo que muestra el
// celular al abrirla, así no hay salto), el nombre con los palos y una ficha
// girando. Se muestra desde el primer HTML del servidor hasta que están los
// datos, y se va con un fundido (`leaving`) para que la app aparezca entera.

"use client"

import { useEffect, type ReactNode } from "react"
import { ChipSpinner } from "@/components/poker-chip"
import { SUIT_RED } from "@/components/training/playing-card"
import { cn } from "@/lib/utils"

/** El splash se arma varias veces seguidas (servidor, carga, fundido): el ícono entra animado solo la primera. */
let shownOnce = false

export function SplashScreen({ leaving = false, children }: { leaving?: boolean; children?: ReactNode }) {
  const animate = !shownOnce
  useEffect(() => {
    shownOnce = true
  }, [])
  return (
    <div
      aria-busy={!leaving}
      aria-hidden={leaving}
      className={cn(
        "fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-background px-6 text-foreground transition-opacity duration-300",
        leaving && "pointer-events-none opacity-0",
      )}
    >
      <div className="relative">
        <div aria-hidden className="absolute inset-0 -z-10 scale-125 rounded-full bg-primary/25 blur-3xl" />
        {/* eslint-disable-next-line @next/next/no-img-element -- tiene que estar en el primer HTML, sin esperar a next/image */}
        <img
          src="/icon-splash.webp"
          alt=""
          width={160}
          height={160}
          fetchPriority="high"
          className={cn("size-40 rounded-[28%] shadow-2xl", animate && "animate-splash-in")}
        />
      </div>
      <div className="flex items-center gap-3 text-xl font-bold">
        <span aria-hidden>{"♠︎"}</span>
        <span aria-hidden className={SUIT_RED}>
          {"♥︎"}
        </span>
        <h1>La Cajita</h1>
        <span aria-hidden className={SUIT_RED}>
          {"♦︎"}
        </span>
        <span aria-hidden>{"♣︎"}</span>
      </div>
      <ChipSpinner className="size-7 opacity-80" />
      {children}
    </div>
  )
}
