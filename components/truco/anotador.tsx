"use client"

// Anotador de Truco para partidas de verdad (ver docs/plan-truco.md): dos
// equipos, fósforos de a 5, a 15 o a 30 (malas arriba, buenas abajo). Tocar la
// columna suma 1; mantener apretado medio segundo saca 1 (el último fósforo se
// va apagando; en Android vibra). La pantalla no se apaga mientras está a la
// vista. Todo queda en este celular (localStorage).

import { useEffect, useRef, useState } from "react"
import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  addPoint,
  freshScorer,
  halves,
  parseScorer,
  removePoint,
  renameTeam,
  scorerWinner,
  setTarget,
  type ScorerState,
  type Team,
} from "@/lib/truco/scorer"
import { cn } from "@/lib/utils"
import { Fosforos } from "./fosforos"

const KEY = "la-cajita:truco:anotador"
const HOLD_MS = 500
/** Si el dedo se mueve más que esto, es un scroll: no suma ni resta. */
const MOVE_TOLERANCE = 12

/** Pide que la pantalla no se apague mientras `active` (y la vuelve a pedir al volver a la app). */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const request = async () => {
      if (document.visibilityState !== "visible" || lock) return
      try {
        const l = await navigator.wakeLock.request("screen")
        if (cancelled) {
          l.release()
          return
        }
        lock = l
        l.addEventListener("release", () => {
          if (lock === l) lock = null
        })
      } catch {
        // sin permiso o sin batería: la pantalla se apaga como siempre
      }
    }
    request()
    document.addEventListener("visibilitychange", request)
    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", request)
      lock?.release()
    }
  }, [active])
}

function TeamColumn({
  s,
  team,
  onAdd,
  onRemove,
  onRename,
}: {
  s: ScorerState
  team: Team
  onAdd: () => void
  onRemove: () => void
  onRename: (name: string) => void
}) {
  const score = s.score[team]
  const { malas, buenas } = halves(score, s.target)
  const where = s.target === 30 ? (score >= 15 ? "en las buenas" : "en las malas") : "de 15"

  const [holding, setHolding] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  /** Ya se sacó un fósforo con este toque: el click que sigue no suma. */
  const removed = useRef(false)
  const [name, setName] = useState(s.names[team])
  useEffect(() => setName(s.names[team]), [s.names, team])

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    setHolding(false)
  }
  useEffect(() => cancel, [])

  const fading = "opacity-15 transition-opacity duration-500 ease-linear"

  return (
    <div className="flex min-w-0 flex-col items-center gap-2 rounded-2xl border bg-card p-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => onRename(name)}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        maxLength={18}
        aria-label={`Nombre del equipo ${team + 1}`}
        className="w-full border-b border-dashed border-border bg-transparent px-1 py-1 text-center text-lg font-bold outline-none focus:border-primary"
      />
      <div className="flex flex-col items-center leading-none" aria-live="polite">
        <span className="text-5xl font-bold tabular-nums">{score}</span>
        <span className="mt-1 text-xs text-muted-foreground">{where}</span>
      </div>
      <button
        aria-label={`Sumar un punto a ${s.names[team]}. Mantené apretado para sacar uno.`}
        className={cn(
          "flex w-full flex-1 touch-manipulation select-none flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/40 px-1 py-3",
          "[-webkit-touch-callout:none] active:bg-muted",
        )}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          removed.current = false
          start.current = { x: e.clientX, y: e.clientY }
          if (score === 0) return
          setHolding(true)
          timer.current = setTimeout(() => {
            timer.current = null
            removed.current = true
            setHolding(false)
            onRemove()
            navigator.vibrate?.(40)
          }, HOLD_MS)
        }}
        onPointerMove={(e) => {
          if (!start.current) return
          if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > MOVE_TOLERANCE) {
            start.current = null
            cancel()
          }
        }}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={() => {
          start.current = null
          cancel()
        }}
        onClick={() => {
          // Click después de mantener (ya restó) o después de un scroll: no suma.
          if (removed.current || !start.current) {
            removed.current = false
            return
          }
          onAdd()
        }}
      >
        <Fosforos
          n={malas}
          className="min-h-[148px] flex-col flex-nowrap items-center content-start"
          groupClassName="size-11"
          lastClassName={holding && buenas === 0 ? fading : undefined}
        />
        {s.target === 30 && (
          <>
            <span aria-hidden className="w-4/5 border-t-2 border-foreground/40" />
            <Fosforos
              n={buenas}
              className="min-h-[148px] flex-col flex-nowrap items-center content-start"
              groupClassName="size-11"
              lastClassName={holding && buenas > 0 ? fading : undefined}
            />
          </>
        )}
      </button>
      <div className="text-xs text-muted-foreground">
        Partidas ganadas: <b className="text-foreground">{s.wins[team]}</b>
      </div>
    </div>
  )
}

export function Anotador({ active }: { active: boolean }) {
  const [s, setS] = useState<ScorerState>(() => freshScorer())
  const loaded = useRef(false)
  const [confirm, setConfirm] = useState<null | { kind: "reset" } | { kind: "target"; target: 15 | 30 }>(null)

  useEffect(() => {
    try {
      setS(parseScorer(localStorage.getItem(KEY)))
    } catch {}
    loaded.current = true
  }, [])
  useEffect(() => {
    if (!loaded.current) return
    try {
      localStorage.setItem(KEY, JSON.stringify(s))
    } catch {}
  }, [s])

  useWakeLock(active)

  const winner = scorerWinner(s)
  const hasPoints = s.score[0] + s.score[1] > 0

  const chooseTarget = (t: 15 | 30) => {
    if (t === s.target) return
    if (hasPoints) setConfirm({ kind: "target", target: t })
    else setS(setTarget(s, t))
  }

  return (
    <div className="flex flex-col gap-3 pt-4 pb-8">
      <div className="flex items-center justify-between gap-2">
        <div role="radiogroup" aria-label="A cuántos puntos" className="flex rounded-full bg-muted p-1">
          {([15, 30] as const).map((t) => (
            <button
              key={t}
              role="radio"
              aria-checked={s.target === t}
              onClick={() => chooseTarget(t)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                s.target === t ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              A {t}
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={!hasPoints}
          onClick={() => setConfirm({ kind: "reset" })}
          className="gap-1.5 text-muted-foreground"
        >
          <RotateCcw className="size-4" />
          Empezar de cero
        </Button>
      </div>

      {winner !== null && (
        <div className="animate-fade-in flex flex-col items-center gap-2 rounded-2xl border border-primary bg-primary/10 p-4 text-center">
          <p className="text-xl font-bold">¡Ganó {s.names[winner]}!</p>
          <p className="text-sm text-muted-foreground">
            {s.score[winner]} a {s.score[1 - winner]}
          </p>
          <Button onClick={() => setS(freshScorer(s))}>Otra partida</Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {([0, 1] as const).map((team) => (
          <TeamColumn
            key={team}
            s={s}
            team={team}
            onAdd={() => setS((x) => addPoint(x, team))}
            onRemove={() => setS((x) => removePoint(x, team))}
            onRename={(name) => setS((x) => renameTeam(x, team, name))}
          />
        ))}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Tocá la columna para sumar un punto. Mantené apretado para sacar uno.
      </p>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "target" ? `¿Pasar a jugar a ${confirm.target}?` : "¿Empezar de cero?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se borran los puntos de esta partida. Los nombres y las partidas ganadas quedan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm?.kind === "target") setS(setTarget(s, confirm.target))
                else setS(freshScorer(s))
                setConfirm(null)
              }}
            >
              Borrar puntos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
