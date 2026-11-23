"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { makePotOdds, type PotOddsDrill as PotOddsData } from "@/lib/poker/drills"
import { cn } from "@/lib/utils"
import { DrillShell, pct, pesos, useDrill, type DrillProps } from "./drill-shell"
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
      title="¿Pagás o te vas?"
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
              ? "Si pagás, se ven turn y river sin más apuestas."
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
      feedback={
        <div className="space-y-2">
          <p>
            Pagás {pesos(bet)} para ganar {pesos(pot + bet)} (lo que hay en el pozo más la apuesta). Para que te convenga
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
            {drill.close ? "es casi lo mismo: da igual." : drill.shouldCall ? "conviene pagar." : "conviene irse."}
          </p>
        </div>
      }
    >
      <SpotView {...drill} variant={variant} />
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          disabled={answered}
          onClick={() => choose("fold")}
          className={cn(
            "disabled:opacity-100",
            answered && !drill.shouldCall && "border-emerald-500 bg-emerald-500/10",
            answered && picked === "fold" && drill.shouldCall && !drill.close && "border-rose-500 bg-rose-500/10",
          )}
        >
          Me voy
        </Button>
        <Button
          variant="outline"
          disabled={answered}
          onClick={() => choose("call")}
          className={cn(
            "disabled:opacity-100",
            answered && drill.shouldCall && "border-emerald-500 bg-emerald-500/10",
            answered && picked === "call" && !drill.shouldCall && !drill.close && "border-rose-500 bg-rose-500/10",
          )}
        >
          Pago {pesos(bet)}
        </Button>
      </div>
    </DrillShell>
  )
}
