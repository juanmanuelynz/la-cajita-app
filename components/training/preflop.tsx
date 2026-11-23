"use client"

import { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { makePreflop, type PreflopDrill as PreflopData } from "@/lib/poker/drills"
import {
  OPEN_RANGES,
  POSITIONS_BY_TABLE,
  PREFLOP_SOURCE,
  gridClasses,
  openPercent,
  openRange,
  type HandClass,
  type Position,
} from "@/lib/poker/preflop"
import type { Variant } from "@/lib/poker/variants"
import { cn } from "@/lib/utils"
import { CardRow } from "./playing-card"
import { DrillShell, Label, pct, useDrill, type DrillProps } from "./drill-shell"

const HOLDEM_LONG: Variant = { game: "holdem", deck: "long" }
const TABLE_SIZES = [4, 5, 6] as const

/** Grilla 13×13: arriba a la derecha las suited, abajo a la izquierda las offsuit. */
export function RangeGrid({ pos, highlight }: { pos: Position; highlight?: HandClass }) {
  const range = openRange(pos)
  return (
    <div className="grid gap-px rounded overflow-hidden bg-border" style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}>
      {gridClasses()
        .flat()
        .map((h) => {
          const inRange = range.has(h)
          return (
            <div
              key={h}
              className={cn(
                "aspect-square flex items-center justify-center text-[8px] leading-none font-medium tabular-nums",
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

function SourceNote() {
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
  const [table, setTable] = useState<4 | 5 | 6>(6)
  const make = useCallback((v: Variant) => makePreflop(v, Math.random, table), [table])
  const { drill, verdict, score, answer, next, inChallenge } = useDrill(
    "preflop",
    { ...props, variant: HOLDEM_LONG },
    make,
  )
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
                className={cn("rounded px-2.5 py-0.5", table === n ? "bg-background shadow-sm font-medium" : "text-muted-foreground")}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
      <DrillShell
        title="¿Abrís?"
        question={
          <>
            Mesa de {drill.table}. Estás en <b>{info.name}</b> y todos los anteriores tiraron. ¿Subís o tirás?
            <span className="block text-xs text-muted-foreground mt-1">Solo Hold&apos;em con mazo largo.</span>
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
            <p>
              <b>{drill.hand}</b> {drill.open ? "está" : "no está"} en el rango de apertura de {drill.pos}: desde ahí
              se abre el {pct(openPercent(drill.pos), 0)} de las manos, subiendo a {info.openSize} ciegas grandes.
            </p>
            <RangeGrid pos={drill.pos} highlight={drill.hand} />
            <SourceNote />
          </div>
        }
      >
        <SeatsRow table={drill.table} pos={drill.pos} />
        <div>
          <Label>Tu mano</Label>
          <CardRow cards={drill.cards} />
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
              {open ? "Subo" : "Tiro"}
            </Button>
          ))}
        </div>
      </DrillShell>
    </div>
  )
}

/** Tabla de rangos para la pestaña Jugadas. */
export function PreflopRanges({ variant }: { variant: Variant }) {
  const [pos, setPos] = useState<Position>("CO")
  if (variant.game !== "holdem" || variant.deck !== "long") {
    return (
      <p className="text-xs text-muted-foreground px-1">
        Las tablas de qué manos abrir son solo para Hold&apos;em con mazo largo: no encontramos una fuente confiable para
        Omaha, Manhattan ni short deck.
      </p>
    )
  }
  const positions: Position[] = ["UTG", "MP", "CO", "BU", "SB"]
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm">Qué manos abrir</h3>
      <p className="text-xs text-muted-foreground">
        Cuando todos los anteriores tiraron. En verde, las manos con las que se sube.
      </p>
      <div className="flex rounded-md bg-muted p-0.5 text-sm">
        {positions.map((p) => (
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
        {OPEN_RANGES[pos].name}: {pct(openPercent(pos), 0)} de las manos ({OPEN_RANGES[pos].combos} combinaciones),
        subiendo a {OPEN_RANGES[pos].openSize} ciegas grandes.
      </div>
      <RangeGrid pos={pos} />
      <SourceNote />
    </div>
  )
}
