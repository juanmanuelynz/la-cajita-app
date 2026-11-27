"use client"

// Pantallas de carga de La Cajita. Poker: paño verde de borde a borde (el mismo
// color que Android usa al abrir la app instalada, ver manifest.json) con la
// ficha del ícono girando y el logo. Truco: paño azul con las cuatro bravas en
// abanico. Se muestran desde el primer HTML y se van con un fundido (`leaving`).

import type { CSSProperties, ReactNode } from "react"
import { ChipLogo } from "@/components/chip-logo"
import { LogoType } from "@/components/logo-type"
import { BravasFan } from "@/components/truco/bravas-fan"
import { SuitGlyph } from "@/components/truco/suit-glyph"
import { cn } from "@/lib/utils"

function SplashFrame({
  leaving,
  className,
  style,
  children,
}: {
  leaving: boolean
  className: string
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <div
      aria-busy={!leaving}
      aria-hidden={leaving}
      style={style}
      className={cn(
        "fixed inset-0 z-[60] flex flex-col items-center justify-center gap-8 px-6 transition-opacity duration-300",
        className,
        leaving && "pointer-events-none opacity-0",
      )}
    >
      {children}
    </div>
  )
}

/** Fondos de los splash (los usa también el login, que arma la misma escena). */
export const POKER_SPLASH_BG = "bg-[radial-gradient(ellipse_at_50%_40%,#1f9a6b,#063d2b_75%)] text-[#fbf6ea]"
export const TRUCO_SPLASH_BG = "bg-[radial-gradient(ellipse_at_50%_40%,#3a72c2,#122a52_75%)] text-[#f4ecd8]"
/** La ficha del splash de Poker, quieta (el login la deja así y el splash la hace girar). */
export const SPLASH_CHIP_CLASS = "block size-full drop-shadow-[0_18px_24px_rgb(0_0_0/0.45)]"

/** Logo de Poker con los cuatro palos, debajo de la ficha. */
export function PokerLogoRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-4 text-xl", className)}>
      <span aria-hidden>{"♠︎"}</span>
      <span aria-hidden className="text-[#f4a39b]">
        {"♥︎"}
      </span>
      <LogoType className="text-[32px] !text-[#e2ab3c]" />
      <span aria-hidden className="text-[#f4a39b]">
        {"♦︎"}
      </span>
      <span aria-hidden>{"♣︎"}</span>
    </div>
  )
}

/** Logo de Truco con los cuatro palos españoles, debajo del abanico. */
export function TrucoLogoRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <SuitGlyph suit="espada" className="size-5" />
      <SuitGlyph suit="copa" className="size-5 text-[#e2ab3c]" />
      <LogoType className="text-[32px] !text-[#e2ab3c]" />
      <SuitGlyph suit="oro" className="size-5 text-[#e2ab3c]" />
      <SuitGlyph suit="basto" className="size-5" />
    </div>
  )
}

/** Splash de Poker: la ficha gira sobre su eje mientras carga. */
export function SplashScreen({ leaving = false, children }: { leaving?: boolean; children?: ReactNode }) {
  return (
    <SplashFrame leaving={leaving} className={POKER_SPLASH_BG}>
      <span role="status" aria-label="Cargando" className="block size-56 [perspective:600px]">
        <ChipLogo className={cn(SPLASH_CHIP_CLASS, "animate-chip-flip [animation-duration:2.2s]")} />
      </span>
      <PokerLogoRow />
      {children}
    </SplashFrame>
  )
}

/** Splash de Truco (al abrir la app en Truco): las bravas se abren en abanico. */
export function TrucoSplash({ leaving = false }: { leaving?: boolean }) {
  return (
    <SplashFrame leaving={leaving} className={TRUCO_SPLASH_BG}>
      <span role="status" aria-label="Cargando">
        <BravasFan animated reversed className="mb-6 scale-125" />
      </span>
      <TrucoLogoRow />
    </SplashFrame>
  )
}
