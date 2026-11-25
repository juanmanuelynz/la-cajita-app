"use client"

import { ChevronRight, Lock, RefreshCw } from "lucide-react"
import { ChipSpinner } from "@/components/poker-chip"
import { cn } from "@/lib/utils"

/**
 * El torneo que se está mirando, dentro de las pantallas donde importa
 * (Ranking, Partidas, Estadísticas). Tocar el nombre lleva a Ajustes → Torneo,
 * donde se elige; al lado, refrescar.
 */
export function TournamentLine({
  name,
  closed,
  loading,
  onOpen,
  onRefresh,
  title,
  className,
}: {
  name: string
  closed?: boolean
  loading: boolean
  onOpen?: () => void
  onRefresh: () => void
  /** Grande, como título de la pantalla (Ranking). */
  title?: boolean
  className?: string
}) {
  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        aria-label={onOpen ? `${name}: cambiar de torneo` : name}
        className={cn(
          "group flex min-w-0 items-center gap-1 transition-colors",
          title ? "text-2xl font-bold" : "text-sm text-muted-foreground hover:text-foreground",
        )}
      >
        <span className="truncate">{name}</span>
        {closed && <Lock className={cn("shrink-0", title ? "h-5 w-5" : "h-3.5 w-3.5")} aria-label="Cerrado" />}
        {onOpen && (
          <ChevronRight
            className={cn(
              "shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5",
              title ? "h-5 w-5" : "h-4 w-4",
            )}
          />
        )}
      </button>
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        aria-label="Refrescar"
        className="shrink-0 p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
      >
        {loading ? <ChipSpinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
      </button>
    </div>
  )
}
