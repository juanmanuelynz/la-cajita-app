"use client"

import { useCallback, useState } from "react"
import { FlaskConical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { makePreflop, type PreflopDrill as PreflopData } from "@/lib/poker/drills"
import {
  OPEN_RANGES,
  POSITIONS_BY_TABLE,
  PREFLOP_SOURCE,
  gridClasses,
  openPercent,
  openRange,
  describeClass,
  type HandClass,
  type Position,
} from "@/lib/poker/preflop"
import { BETA_VALIDATION, betaThreshold, shortOpens } from "@/lib/poker/preflop-beta"
import { GAMES, type Variant } from "@/lib/poker/variants"
import { cn } from "@/lib/utils"
import { CardRow } from "./playing-card"
import { DrillShell, Label, pct, useDrill, type DrillProps } from "./drill-shell"

const TABLE_SIZES = [4, 5, 6] as const
const POSITIONS: Position[] = ["UTG", "MP", "CO", "BU", "SB"]

const isSourced = (v: Variant) => v.game === "holdem" && v.deck === "long"

/** ¿Abre esta clase de Hold'em desde esta posición? (fuente en largo, Beta en short). */
function holdemOpens(v: Variant, cls: HandClass, pos: Position) {
  return v.deck === "long" ? openRange(pos).has(cls) : shortOpens(cls, pos)
}

/** Grilla 13×13 (9×9 en short): arriba a la derecha las del mismo palo, abajo a la izquierda las de distinto palo. */
export function RangeGrid({ variant, pos, highlight }: { variant: Variant; pos: Position; highlight?: HandClass | null }) {
  const grid = gridClasses(variant.deck)
  return (
    <div
      className="grid gap-px rounded overflow-hidden bg-border"
      style={{ gridTemplateColumns: `repeat(${grid.length}, minmax(0, 1fr))` }}
    >
      {grid.flat().map((h) => {
        const inRange = holdemOpens(variant, h, pos)
        return (
          <div
            key={h}
            className={cn(
              "aspect-square flex items-center justify-center leading-none font-medium tabular-nums",
              grid.length > 9 ? "text-[8px]" : "text-[10px]",
              inRange ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground",
              h === highlight && "ring-2 ring-amber-400 ring-inset z-10 font-bold",
            )}
          >
            {h.length === 2 ? h : h.slice(0, 2)}
          </div>
        )
      })}
    </div>
  )
}

export function BetaBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-violet-500/15 text-violet-400 px-1.5 py-0.5 text-[11px] font-semibold">
      <FlaskConical className="w-3 h-3" /> Beta
    </span>
  )
}

function SourceNote({ variant }: { variant: Variant }) {
  if (!isSourced(variant)) {
    const v = BETA_VALIDATION
    return (
      <p className="text-[11px] text-muted-foreground">
        <b>Beta, inferido:</b> no hay una fuente confiable para {GAMES[variant.game].name}
        {variant.deck === "short" ? " short" : ""}. Ordenamos las manos por lo seguido que ganan contra 2 manos al azar
        y abrimos el mismo % que en Hold&apos;em ({pct(openPercent("UTG"), 0)} en UTG … {pct(openPercent("BU"), 0)} en
        BU). Probado en Hold&apos;em largo contra la tabla real, coincide en el {pct(Math.min(...Object.values(v)), 0)}–
        {pct(Math.max(...Object.values(v)), 0)} de las manos, pero se equivoca justo en las de borde: le da poco valor a
        los pares chicos y a las cartas seguidas del mismo palo, y demasiado a ases y reyes de distinto palo.
      </p>
    )
  }
  return (
    <p className="text-[11px] text-muted-foreground">
      Fuente:{" "}
      <a href={PREFLOP_SOURCE.url} target="_blank" rel="noreferrer" className="underline">
        PokerStrategy.com
      </a>
      , rangos de apertura para 6 jugadores (No-Limit, rival estándar de NL200). Con 4 o 5 jugadores sacamos las
      primeras posiciones: eso es adaptación nuestra, no de la fuente.
    </p>
  )
}

/** Qué quiere decir cada sigla de la mesa. */
function SeatsLegend() {
  return (
    <p className="text-[11px] text-muted-foreground -mt-2">
      Hablan en este orden. UTG, MP y CO: 3, 2 y 1 lugar antes del que reparte · BU: el que reparte · SB y BB: ciega
      chica y ciega grande.
    </p>
  )
}

/** Orden en que se habla antes del flop, marcando dónde estás. */
function SeatsRow({ table, pos }: { table: 4 | 5 | 6; pos: Position }) {
  const seats = [...POSITIONS_BY_TABLE[table], "BB"] as const
  const me = seats.indexOf(pos)
  return (
    <div className="flex gap-1">
      {seats.map((s, i) => (
        <div
          key={s}
          className={cn(
            "flex-1 rounded border py-1 text-center text-[11px]",
            i < me && "line-through text-muted-foreground opacity-60",
            i === me && "border-amber-400 bg-amber-400/15 font-semibold",
          )}
        >
          {s}
        </div>
      ))}
    </div>
  )
}

export function PreflopDrill(props: DrillProps<PreflopData>) {
  const { variant } = props
  const [table, setTable] = useState<4 | 5 | 6>(6)
  const make = useCallback((v: Variant) => makePreflop(v, Math.random, table), [table])
  const { drill, verdict, score, answer, next, inChallenge } = useDrill("preflop", props, make)
  const [picked, setPicked] = useState<boolean | null>(null)

  if (!drill) return null
  const answered = verdict !== null
  const info = OPEN_RANGES[drill.pos]
  const choose = (open: boolean) => {
    setPicked(open)
    answer(open === drill.open ? "right" : "wrong")
  }

  return (
    <div className="space-y-3">
      {!inChallenge && (
        <div className="flex items-center gap-2 pt-2 text-xs">
          <span className="text-muted-foreground">Jugadores en la mesa</span>
          <div className="flex rounded-md bg-muted p-0.5">
            {TABLE_SIZES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setTable(n)}
                className={cn(
                  "rounded px-2.5 py-0.5",
                  table === n ? "bg-background shadow-sm font-medium" : "text-muted-foreground",
                )}
              >
                {n}
              </button>
            ))}
          </div>
          {drill.beta && <BetaBadge />}
        </div>
      )}
      <DrillShell
        title="Antes del flop · con ciegas"
        question={
          <>
            Mesa de {drill.table}. Estás <b>{info.where}</b> y
            todos los que hablaron antes hicieron fold. ¿Subís o fold?
          </>
        }
        score={inChallenge ? undefined : score}
        nextLabel={props.nextLabel}
        verdict={verdict}
        onNext={() => {
          setPicked(null)
          next()
        }}
        feedback={
          <div className="space-y-2">
            {drill.hand ? (
              <p>
                <b>{describeClass(drill.hand)}</b> {drill.open ? "es" : "no es"} de las manos para subir desde{" "}
                {drill.pos}
                {drill.beta ? " (Beta)" : ""}: desde ese lugar se juega el {pct(openPercent(drill.pos), 0)} de las manos
                {drill.beta ? "." : `, subiendo a ${info.openSize} veces la ciega grande.`}
              </p>
            ) : (
              <p>
                Esta mano se lleva el <b>{pct(drill.equity!, 1)}</b> del pozo contra 2 manos al azar. Para estar en el{" "}
                {pct(openPercent(drill.pos), 0)} mejor y subir desde {drill.pos} hace falta al menos{" "}
                <b>{pct(drill.threshold!, 1)}</b> (Beta).
              </p>
            )}
            {drill.hand && <RangeGrid variant={variant} pos={drill.pos} highlight={drill.hand} />}
            <SourceNote variant={variant} />
          </div>
        }
      >
        <SeatsRow table={drill.table} pos={drill.pos} />
        <SeatsLegend />
        <div>
          <Label>Tu mano</Label>
          <CardRow cards={drill.cards} size={variant.game === "holdem" ? "md" : "sm"} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[false, true].map((open) => (
            <Button
              key={String(open)}
              variant="outline"
              disabled={answered}
              onClick={() => choose(open)}
              className={cn(
                "disabled:opacity-100",
                answered && open === drill.open && "border-emerald-500 bg-emerald-500/10",
                answered && picked === open && open !== drill.open && "border-rose-500 bg-rose-500/10",
              )}
            >
              {open ? "Subo" : "Fold"}
            </Button>
          ))}
        </div>
      </DrillShell>
    </div>
  )
}

/** Tabla de qué manos abrir, para la pestaña Jugadas. */
export function PreflopRanges({ variant }: { variant: Variant }) {
  const [pos, setPos] = useState<Position>("CO")
  const sourced = isSourced(variant)
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        Con qué manos subir {!sourced && <BetaBadge />}
      </h3>
      <p className="text-xs text-muted-foreground">Mesa con ciegas, cuando todos los que hablaron antes hicieron fold.</p>
      <SeatsLegend />
      <div className="flex rounded-md bg-muted p-0.5 text-sm">
        {POSITIONS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPos(p)}
            className={cn("flex-1 rounded py-1", pos === p ? "bg-background shadow-sm font-medium" : "text-muted-foreground")}
          >
            {p}
          </button>
        ))}
      </div>
      <div className="text-xs">
        {OPEN_RANGES[pos].name}: se abre el {pct(openPercent(pos), 0)} de las manos
        {sourced ? `, subiendo a ${OPEN_RANGES[pos].openSize} veces la ciega grande.` : "."}
      </div>
      {variant.game === "holdem" ? (
        <>
          <p className="text-xs text-muted-foreground">
            En verde, las manos con las que se sube. Arriba a la derecha las del mismo palo («s»), abajo a la izquierda
            las de distinto palo («o»), y en la diagonal los pares.
          </p>
          <RangeGrid variant={variant} pos={pos} />
        </>
      ) : (
        <div className="rounded-lg border p-3 text-sm space-y-1">
          <p>
            Con {GAMES[variant.game].holeCount} cartas no entra una grilla: hay demasiadas manos distintas. La regla Beta
            es subir desde {pos} si tu mano se lleva al menos el{" "}
            <b>{pct(betaThreshold(variant, pos), 1)}</b> del pozo contra 2 manos al azar.
          </p>
          <ul className="text-xs text-muted-foreground grid grid-cols-5 gap-1 pt-1">
            {POSITIONS.map((p) => (
              <li key={p} className={cn("text-center rounded py-1", p === pos && "bg-muted font-medium text-foreground")}>
                {p}
                <br />
                {pct(betaThreshold(variant, p), 0)}
              </li>
            ))}
          </ul>
        </div>
      )}
      <SourceNote variant={variant} />
    </div>
  )
}
