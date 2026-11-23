"use client"

import { useState } from "react"
import { handTraits, makeCompare, type CompareDrill as CompareData } from "@/lib/poker/drills"
import { CardRow } from "./playing-card"
import { PickableHand } from "./table-view"
import { DrillShell, Stats, pct, useDrill, type DrillProps } from "./drill-shell"

const NAMES = ["Mano A", "Mano B"] as const

export function CompareDrill(props: DrillProps<CompareData>) {
  const { variant } = props
  const { drill, verdict, score, answer, next, inChallenge } = useDrill("compare", props, makeCompare)
  const [picked, setPicked] = useState<0 | 1 | null>(null)

  if (!drill) return null
  const answered = verdict !== null
  const size = variant.game === "holdem" ? "md" : "sm"

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
      <div className="space-y-2">
        {drill.hands.map((hand, i) => (
          <PickableHand
            key={i}
            title={NAMES[i]}
            detail={answered ? <b className="text-sm text-foreground tabular-nums">{pct(drill.equity[i], 0)}</b> : undefined}
            onPick={() => {
              setPicked(i as 0 | 1)
              answer(drill.better === i ? "right" : "wrong")
            }}
            answered={answered}
            correct={drill.better === i}
            picked={picked === i}
          >
            <CardRow cards={hand} size={size} deal={i * 350} />
            {answered && (
              <div className="mt-2 flex flex-wrap gap-1">
                {handTraits(hand).map((t) => (
                  <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </PickableHand>
        ))}
      </div>
    </DrillShell>
  )
}
