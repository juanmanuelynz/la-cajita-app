"use client"

import { useEffect, useState } from "react"
import { ChevronDown, ChevronUp, Flame, UserRound } from "lucide-react"
import * as db from "@/lib/database"
import { getTodayLocalDate } from "@/lib/formatters"
import { DRILL_IDS, DRILL_NAMES, dayStreak } from "@/lib/poker/training"
import { GAMES, GAME_IDS } from "@/lib/poker/variants"
import type { Player, TrainingProgress, TrainingTally } from "@/lib/types"
import { cn } from "@/lib/utils"
import { pct } from "./drill-shell"

/** Selector de jugador: quién está entrenando en este celular. */
export function PlayerSelect({
  players,
  value,
  onChange,
  className,
}: {
  players: Player[]
  value: string | null
  onChange: (id: string | null) => void
  className?: string
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className={cn("rounded-md border bg-background px-2 py-1.5 text-sm", className)}
      aria-label="Quién está entrenando"
    >
      <option value="">¿Quién sos?</option>
      {players.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  )
}

function TallyBar({ label, tally }: { label: string; tally?: TrainingTally }) {
  const total = tally?.total ?? 0
  const ratio = total ? tally!.right / total : 0
  return (
    <div>
      <div className="flex justify-between text-xs mb-0.5">
        <span>{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {total ? `${pct(ratio, 0)} · ${tally!.right}/${total}` : "sin jugar"}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full", ratio >= 0.8 ? "bg-emerald-500" : ratio >= 0.5 ? "bg-amber-500" : "bg-rose-500")}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  )
}

/**
 * Fila con quién entrena, la racha de días y lo de hoy; se despliega con el
 * detalle por ejercicio y por juego. `version` cambia con cada respuesta para
 * refrescar los números.
 */
export function ProgressPanel({
  players,
  playerId,
  onPlayerChange,
  version,
}: {
  players: Player[]
  playerId: string | null
  onPlayerChange: (id: string | null) => void
  version: number
}) {
  const [progress, setProgress] = useState<TrainingProgress | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!playerId) {
      setProgress(null)
      return
    }
    let cancelled = false
    // Pequeña demora: si responde varias seguidas, una sola consulta.
    const t = setTimeout(() => {
      db.getTrainingProgress(playerId, getTodayLocalDate()).then(
        (p) => !cancelled && setProgress(p),
        () => {}, // sin conexión: se queda con lo último que tenía
      )
    }, 600)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [playerId, version])

  if (!playerId) {
    return (
      <div className="rounded-lg border border-dashed p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <UserRound className="w-4 h-4" /> Guardá tu progreso
        </div>
        <p className="text-xs text-muted-foreground">
          Elegí tu nombre para guardar tus aciertos y jugar el Desafío del día. Queda recordado en este celular.
        </p>
        <PlayerSelect players={players} value={null} onChange={onPlayerChange} className="w-full" />
      </div>
    )
  }

  const streak = progress ? dayStreak(progress.days, getTodayLocalDate()) : 0
  const all = progress
    ? Object.values(progress.byDrill).reduce((a, t) => ({ right: a.right + t.right, total: a.total + t.total }), {
        right: 0,
        total: 0,
      })
    : null

  return (
    <div className="rounded-lg border">
      <div className="flex items-center gap-2 p-2">
        <PlayerSelect players={players} value={playerId} onChange={onPlayerChange} className="min-w-0 flex-1" />
        <span
          className={cn(
            "flex items-center gap-0.5 text-sm tabular-nums",
            streak > 0 ? "text-amber-500 font-semibold" : "text-muted-foreground",
          )}
          title="Días seguidos entrenando"
        >
          <Flame className="w-4 h-4" />
          {streak}
        </span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 text-xs text-muted-foreground px-1"
        >
          Hoy {progress?.today.right ?? 0}/{progress?.today.total ?? 0}
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {open && (
        <div className="border-t p-3 space-y-4">
          {!progress ? (
            <p className="text-xs text-muted-foreground">Cargando…</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-lg font-bold tabular-nums">{all?.total ?? 0}</div>
                  <div className="text-[10px] uppercase text-muted-foreground">respuestas</div>
                </div>
                <div>
                  <div className="text-lg font-bold tabular-nums">{all?.total ? pct(all.right / all.total, 0) : "—"}</div>
                  <div className="text-[10px] uppercase text-muted-foreground">aciertos</div>
                </div>
                <div>
                  <div className="text-lg font-bold tabular-nums">{streak}</div>
                  <div className="text-[10px] uppercase text-muted-foreground">días seguidos</div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Por ejercicio</div>
                {DRILL_IDS.map((d) => (
                  <TallyBar key={d} label={DRILL_NAMES[d]} tally={progress.byDrill[d]} />
                ))}
              </div>
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Por juego</div>
                {GAME_IDS.flatMap((g) =>
                  (["long", "short"] as const).map((d) => (
                    <TallyBar
                      key={`${g}:${d}`}
                      label={`${GAMES[g].name} · ${d === "long" ? "Long" : "Short"}`}
                      tally={progress.byVariant[`${g}:${d}`]}
                    />
                  )),
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
