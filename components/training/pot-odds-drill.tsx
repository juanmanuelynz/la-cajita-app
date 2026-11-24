"use client"

import { useState } from "react"
import { callEv, makePotOdds, type PotOddsDrill as PotOddsData } from "@/lib/poker/drills"
import { AnswerButton, DrillShell, Stats, answerTone, pct, pesos, useDrill, type DrillProps } from "./drill-shell"
import { OutsMath, SpotView } from "./outs-drill"

export function PotOddsDrill(props: DrillProps<PotOddsData>) {
  const { variant } = props
  const { drill, verdict, score, answer, next, inChallenge } = useDrill("potOdds", props, makePotOdds)
  const [picked, setPicked] = useState<"call" | "fold" | null>(null)

  if (!drill) return null
  const answered = verdict !== null
  const { pot, bet, needed, equity, street } = drill
  const allIn = street === "flop"

  const choose = (c: "call" | "fold") => {
    setPicked(c)
    if (drill.close) answer("close")
    else answer((c === "call") === drill.shouldCall ? "right" : "wrong")
  }

  return (
    <DrillShell
      title="¿Call o fold?"
      question={
        <div className="rounded-lg bg-muted/50 p-3 space-y-1">
          <div className="flex justify-between">
            <span>Pozo</span>
            <b className="tabular-nums">{pesos(pot)}</b>
          </div>
          <div className="flex justify-between">
            <span>{allIn ? "El rival va all-in por" : "El rival apuesta"}</span>
            <b className="tabular-nums">{pesos(bet)}</b>
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            {allIn
              ? "Si hacés call, se ven turn y river sin más apuestas."
              : "Falta el river. Para practicar, ves las cartas del rival."}
          </p>
        </div>
      }
      score={inChallenge ? undefined : score}
      nextLabel={props.nextLabel}
      verdict={verdict}
      onNext={() => {
        setPicked(null)
        next()
      }}
      headline={
        <Stats
          items={[
            { label: "necesitás ganar", value: pct(needed, 0) },
            { label: "ganás", value: pct(equity, 0), tone: equity >= needed ? "good" : "bad" },
          ]}
        />
      }
      feedback={
        <div className="space-y-2">
          <p>
            Con call ponés {pesos(bet)} para ganar {pesos(pot + bet)} (lo que hay en el pozo más su apuesta). Para que te convenga
            tenés que ganar al menos {pesos(bet)} ÷ {pesos(pot + 2 * bet)} = <b>{pct(needed)}</b> de las veces.
          </p>
          {allIn ? (
            <p>
              Con turn y river por salir, tu chance exacta de ganar es <b>{pct(equity)}</b>.
            </p>
          ) : (
            <OutsMath variant={variant} outs={drill.outs} ties={drill.ties} unseen={drill.unseen} street="turn" />
          )}
          <p className="font-medium">
            {pct(equity)} {equity >= needed ? "≥" : "<"} {pct(needed)} →{" "}
            {drill.close ? "es casi lo mismo: da igual." : drill.shouldCall ? "conviene call." : "conviene fold."}
          </p>
        </div>
      }
    >
      <SpotView {...drill} variant={variant} />
      <div className="grid grid-cols-2 gap-3">
        {(["fold", "call"] as const).map((c) => (
          <AnswerButton
            key={c}
            tone={answerTone(answered, { correct: (c === "call") === drill.shouldCall, picked: picked === c, close: drill.close })}
            amount={c === "call" ? callEv(pot, bet, equity) : 0}
            onClick={() => choose(c)}
          >
            {c === "call" ? `Call ${pesos(bet)}` : "Fold"}
          </AnswerButton>
        ))}
      </div>
    </DrillShell>
  )
}
