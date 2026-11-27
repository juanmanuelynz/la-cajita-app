"use client"

import type { ComponentType } from "react"
import { cn } from "@/lib/utils"

// Hueco de la barra para el botón del centro: el botón (56px) asoma 36px por
// encima, así que su centro queda 8px arriba del borde de la barra. El hueco
// deja 4px de aire alrededor del botón y apenas muerde la barra.
const NOTCH = "radial-gradient(circle at 50% -8px, transparent 32px, #000 32.5px)"
const NOTCH_MASK = { maskImage: NOTCH, WebkitMaskImage: NOTCH } as const

export interface DockTab<T extends string> {
  id: T
  label: string
  short: string
  icon: ComponentType<{ className?: string }>
}

/**
 * Barra flotante de vidrio de abajo (Poker y Truco): íconos + nombre, y la
 * pestaña `centerId` como botón grande que sobresale. El contenido de cada
 * pantalla tiene que dejar `pb-[var(--dock-space)]` para que no lo tape.
 */
export function DockNav<T extends string>({
  tabs,
  active,
  centerId,
  onSelect,
}: {
  tabs: readonly DockTab<T>[]
  active: T
  centerId: T
  onSelect: (id: T) => void
}) {
  return (
    <nav className="pointer-events-none absolute inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
      <div className="pointer-events-auto relative isolate mx-auto flex h-16 max-w-md items-stretch justify-around px-1">
        {/* El vidrio y su sombra van en capas aparte, con un hueco recortado
            alrededor del botón del centro: queda aire entre la barra y el botón. */}
        <div
          aria-hidden
          style={NOTCH_MASK}
          className="absolute inset-x-5 top-6 -bottom-2 -z-10 rounded-[2rem] bg-black/25 blur-xl dark:bg-black/60"
        />
        <div
          aria-hidden
          style={NOTCH_MASK}
          className={cn(
            "absolute inset-0 -z-10 rounded-[2rem]",
            "border border-foreground/10 bg-background/55 backdrop-blur-xl backdrop-saturate-150",
            "shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]",
          )}
        />
        {tabs.map((tab) => {
          const isActive = active === tab.id
          const Icon = tab.icon
          const center = tab.id === centerId
          return (
            <button
              key={tab.id}
              onClick={() => onSelect(tab.id)}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1 transition-colors duration-200",
                center && "justify-end pb-2",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {center ? (
                <span
                  className={cn(
                    "absolute -top-9 left-1/2 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full",
                    "bg-primary text-primary-foreground ring-1 ring-white/25",
                    "shadow-[0_8px_20px_-4px_color-mix(in_oklch,var(--primary)_60%,transparent),inset_0_1px_0_rgb(255_255_255/0.25)]",
                    "transition-transform duration-200 active:scale-95",
                    isActive && "scale-105",
                  )}
                >
                  <Icon className="h-8 w-8" />
                </span>
              ) : (
                <span
                  className={cn(
                    "flex h-8 w-12 items-center justify-center rounded-full transition-colors duration-200",
                    isActive && "bg-primary/15",
                  )}
                >
                  <Icon className="h-6 w-6" />
                </span>
              )}
              <span className={cn("text-[11px] leading-none", isActive && "font-semibold")}>{tab.short}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
