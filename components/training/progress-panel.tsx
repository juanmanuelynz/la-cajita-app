"use client"

import { useEffect, useState } from "react"
import { Check, ChevronDown, Flame, Target, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import * as db from "@/lib/database"
import { getTodayLocalDate } from "@/lib/formatters"
import {
  DAILY_GOAL,
  DRILL_IDS,
  DRILL_NAMES,
  WEAK_MIN_ANSWERS,
  dayStreak,
  levelFor,
  weakSpots,
  type WeakSpot,
} from "@/lib/poker/training"
import { GAMES, GAME_IDS } from "@/lib/poker/variants"
import type { Player, TrainingProgress, TrainingTally } from "@/lib/types"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { cn } from "@/lib/utils"
import { pct } from "./drill-shell"

/**
 * Progreso de quien entrena. `version` cambia con cada respuesta para
 * refrescar los números (con una pequeña demora: si responde varias
 * seguidas, una sola consulta).
 */
export function useTrainingProgress(playerId: string | null, version: number) {
  const [progress, setProgress] = useState<TrainingProgress | null>(null)
  useEffect(() => {
    if (!playerId) {
      setProgress(null)
      return
    }
    let cancelled = false
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
  return progress
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("")
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary font-black text-primary-foreground",
        className,
      )}
    >
      {initials}
    </div>
  )
}

/** Anillo de la meta del día. */
function GoalRing({ done, goal }: { done: number; goal: number }) {
  const r = 19
  const c = 2 * Math.PI * r
  const ratio = Math.min(1, done / goal)
  const complete = done >= goal
  return (
    <div className="relative h-10 w-10">
      <svg viewBox="0 0 48 48" className="h-10 w-10 -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" strokeWidth="5" className="stroke-muted" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
          className={cn("transition-[stroke-dashoffset] duration-700", complete ? "stroke-amber-400" : "stroke-primary")}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {complete ? (
          <Check className="h-5 w-5 text-amber-400" strokeWidth={3} />
        ) : (
          <span className="text-xs font-bold tabular-nums">{done}</span>
        )}
      </div>
    </div>
  )
}

function PlayerDrawer({
  open,
  onOpenChange,
  players,
  value,
  onChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  players: Player[]
  value: string | null
  onChange: (id: string | null) => void
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>¿Quién entrena?</DrawerTitle>
          <DrawerDescription>Queda guardado en este celular.</DrawerDescription>
        </DrawerHeader>
        <div className="grid grid-cols-3 gap-3 px-4 pb-8 max-h-[60vh] overflow-y-auto">
          {players.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onChange(p.id)
                onOpenChange(false)
              }}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-2xl border p-3 transition-colors active:scale-[0.97]",
                p.id === value ? "border-primary bg-primary/15" : "border-transparent bg-muted/60",
              )}
            >
              <Avatar name={p.name} className="h-12 w-12 text-lg" />
              <span className="w-full truncate text-center text-sm font-medium">{p.name}</span>
            </button>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
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

/** "¿Call o fold? · Omaha Short" (GTO vale igual para todos los juegos: sin juego). */
function spotName(s: WeakSpot) {
  if (s.drill === "gto") return DRILL_NAMES.gto
  return `${DRILL_NAMES[s.drill]} · ${GAMES[s.variant.game].name} ${s.variant.deck === "short" ? "Short" : "Long"}`
}

/** Tus puntos débiles: los 3 ejercicios × juego en que más fallás y el botón para practicarlos. */
function WeakSpots({ progress, onPractice }: { progress: TrainingProgress; onPractice: (spots: WeakSpot[]) => void }) {
  // `?? {}`: durante un deploy el servidor viejo todavía no lo manda.
  const spots = weakSpots(progress.byDrillVariant ?? {})
  return (
    <div className="space-y-2 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-3">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        <Target className="h-3.5 w-3.5" /> Tus puntos débiles
      </div>
      {spots.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Todavía no hay datos suficientes: aparecen cuando tenés al menos {WEAK_MIN_ANSWERS} respuestas en un ejercicio
          con un mismo juego y alguna mal.
        </p>
      ) : (
        <>
          {spots.map((s) => (
            <div key={`${s.drill}:${s.variant.game}:${s.variant.deck}`}>
              <div className="mb-0.5 flex justify-between gap-2 text-xs">
                <span className="min-w-0 truncate">{spotName(s)}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  fallás {s.total - s.right} de {s.total}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-rose-500" style={{ width: `${s.miss * 100}%` }} />
              </div>
            </div>
          ))}
          <Button className="mt-1 w-full" onClick={() => onPractice(spots)}>
            <Target className="mr-1.5 h-4 w-4" /> Practicar lo que más fallo
          </Button>
        </>
      )}
    </div>
  )
}

function StatsDrawer({
  open,
  onOpenChange,
  progress,
  streak,
  onPractice,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  progress: TrainingProgress | null
  streak: number
  onPractice: (spots: WeakSpot[]) => void
}) {
  const all = progress
    ? Object.values(progress.byDrill).reduce((a, t) => ({ right: a.right + t.right, total: a.total + t.total }), {
        right: 0,
        total: 0,
      })
    : null
  const lvl = levelFor(all?.right ?? 0)
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Tu progreso</DrawerTitle>
          <DrawerDescription>
            {progress && <>Nivel {lvl.level} · {lvl.title}: te faltan {lvl.span - lvl.into} aciertos para el {lvl.level + 1}. </>}
            Meta del día: {DAILY_GOAL} respuestas.
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-8 space-y-5 max-h-[65vh] overflow-y-auto">
          {!progress ? (
            <p className="text-xs text-muted-foreground">Cargando…</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { v: String(all?.total ?? 0), l: "respuestas" },
                  { v: all?.total ? pct(all.right / all.total, 0) : "—", l: "aciertos" },
                  { v: String(streak), l: "días seguidos" },
                ].map((s) => (
                  <div key={s.l} className="rounded-xl bg-muted/60 py-2">
                    <div className="text-xl font-black tabular-nums">{s.v}</div>
                    <div className="text-[10px] uppercase text-muted-foreground">{s.l}</div>
                  </div>
                ))}
              </div>
              <WeakSpots
                progress={progress}
                onPractice={(spots) => {
                  onOpenChange(false)
                  onPractice(spots)
                }}
              />
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
      </DrawerContent>
    </Drawer>
  )
}

/**
 * Tarjeta de quien entrena: avatar y nombre (tocando se cambia), nivel con su
 * barra, racha de días y el anillo de la meta de hoy (tocando, el detalle).
 */
export function TrainerCard({
  players,
  playerId,
  onPlayerChange,
  progress,
  onPractice,
}: {
  players: Player[]
  playerId: string | null
  onPlayerChange: (id: string | null) => void
  progress: TrainingProgress | null
  /** "Practicar lo que más fallo" (desde el panel de progreso). */
  onPractice: (spots: WeakSpot[]) => void
}) {
  const [pickOpen, setPickOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const player = players.find((p) => p.id === playerId)

  const drawer = (
    <PlayerDrawer
      open={pickOpen}
      onOpenChange={setPickOpen}
      players={players}
      value={playerId}
      onChange={onPlayerChange}
    />
  )

  if (!player) {
    return (
      <>
        {drawer}
        <button
          type="button"
          onClick={() => setPickOpen(true)}
          className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-primary/50 bg-primary/5 p-3 text-left active:scale-[0.99]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <UserRound className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">¿Quién sos?</div>
            <div className="text-xs text-muted-foreground">Elegí tu nombre para sumar nivel y jugar el desafío</div>
          </div>
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        </button>
      </>
    )
  }

  const right = progress ? Object.values(progress.byDrill).reduce((a, t) => a + t.right, 0) : 0
  const lvl = levelFor(right)
  const streak = progress ? dayStreak(progress.days, getTodayLocalDate()) : 0
  const today = progress?.today.total ?? 0

  return (
    <>
      {drawer}
      <StatsDrawer
        open={statsOpen}
        onOpenChange={setStatsOpen}
        progress={progress}
        streak={streak}
        onPractice={onPractice}
      />
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/20 via-card to-card px-3 py-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPickOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
            aria-label="Cambiar quién entrena"
          >
            <div className="relative">
              <Avatar name={player.name} className="h-10 w-10" />
              <span className="absolute -bottom-1 -right-1 rounded-full border-2 border-card bg-amber-400 px-1.5 text-[10px] font-black leading-4 text-black tabular-nums">
                {lvl.level}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="max-w-[65%] shrink-0 truncate font-bold leading-tight">{player.name}</span>
                <span className="hidden min-w-0 truncate text-xs text-muted-foreground min-[360px]:inline">
                  Nv {lvl.level} · {lvl.title}
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 self-center text-muted-foreground" />
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500 transition-[width] duration-700"
                  style={{ width: `${(lvl.into / lvl.span) * 100}%` }}
                />
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setStatsOpen(true)}
            className="flex shrink-0 items-center gap-2 rounded-xl px-1 py-0.5 active:bg-muted/50"
            aria-label="Ver progreso"
          >
            <div className="flex items-center gap-0.5 leading-none">
              <Flame
                className={cn("h-5 w-5", streak > 0 ? "fill-amber-500/30 text-amber-500" : "text-muted-foreground")}
              />
              <span
                className={cn("text-sm font-black tabular-nums", streak > 0 ? "text-amber-500" : "text-muted-foreground")}
              >
                {streak}
              </span>
            </div>
            <GoalRing done={today} goal={DAILY_GOAL} />
          </button>
        </div>
      </div>
    </>
  )
}
