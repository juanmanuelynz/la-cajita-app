"use client"

import { useState } from "react"
import { handTraits, makeCompare, type CompareDrill as CompareData } from "@/lib/poker/drills"
import { PokerTable, type TableSeat } from "./table-view"
import { DrillShell, Stats, pct, useDrill, type DrillProps } from "./drill-shell"

const NAMES = ["Mano A", "Mano B"] as const

export function CompareDrill(props: DrillProps<CompareData>) {
  const { variant } = props
  const { drill, verdict, score, answer, next, inChallenge } = useDrill("compare", props, makeCompare)
  const [picked, setPicked] = useState<0 | 1 | null>(null)

  if (!drill) return null
  const answered = verdict !== null

  return (
    <DrillShell
      title="¿Cuál es mejor?"
      question="Antes del flop, mano a mano: ¿cuál de las dos gana más seguido?"
      score={inChallenge ? undefined : score}
      nextLabel={props.nextLabel}
      verdict={verdict}
      onNext={() => {
        setPicked(null)
        next()
      }}
      headline={
        <Stats
          items={drill.hands.map((_, i) => ({
            label: NAMES[i],
            value: pct(drill.equity[i], 0),
            tone: drill.better === i ? ("good" as const) : ("neutral" as const),
          }))}
        />
      }
      feedback={
        <div className="space-y-2">
          <p>
            {NAMES[drill.better]} se lleva el {pct(drill.equity[drill.better], 0)} del pozo contra el{" "}
            {pct(drill.equity[1 - drill.better], 0)} de la otra (simulando {drill.samples.toLocaleString("es-AR")} mesas,
            los empates cuentan a medias).
          </p>
          {variant.game === "omaha" && (
            <p className="text-muted-foreground">En Jugadas tenés los principios para elegir manos de Omaha.</p>
          )}
        </div>
      }
    >
      {(() => {
        const seats: TableSeat[] = drill.hands.map((hand, i) => ({
          key: i,
          name: NAMES[i],
          cards: hand,
          detail: answered ? pct(drill.equity[i], 0) : undefined,
          deal: i * 350,
          pick: {
            onPick: () => {
              setPicked(i as 0 | 1)
              answer(drill.better === i ? "right" : "wrong")
            },
            answered,
            correct: drill.better === i,
            picked: picked === i,
          },
        }))
        return <PokerTable top={[seats[0]]} boardLabel="Antes del flop" bottom={[seats[1]]} />
      })()}
      {answered && (
        <div className="space-y-1.5 rounded-xl bg-muted/40 p-2.5">
          {drill.hands.map((hand, i) => (
            <div key={i} className="flex flex-wrap items-center gap-1">
              <span className="w-16 shrink-0 text-xs text-muted-foreground">{NAMES[i]}</span>
              {handTraits(hand).map((t) => (
                <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  {t}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </DrillShell>
  )
}
