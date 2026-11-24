import { Zap } from "lucide-react"

/** Etiqueta de partida suelta (no suma al torneo). */
export function CasualBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-400">
      <Zap className="h-3 w-3" />
      Suelta
    </span>
  )
}
