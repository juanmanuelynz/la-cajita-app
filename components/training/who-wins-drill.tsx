"use client"

import { useState } from "react"
import { Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { makeWhoWins, type WhoWinsDrill as WhoWinsData } from "@/lib/poker/drills"
import { GAMES } from "@/lib/poker/variants"
import { cn } from "@/lib/utils"
import { CardRow } from "./playing-card"
import { DrillShell, Label, useDrill, type DrillProps } from "./drill-shell"

const TIE = -1

export function WhoWinsDrill(props: DrillProps<WhoWinsData>) {
  const { variant } = props
  const { drill, verdict, score, answer, next, inChallenge } = useDrill("whoWins", props, makeWhoWins)
  const [picked, setPicked] = useState<number | null>(null)

  if (!drill) return null
  const answered = verdict !== null
  const isTie = drill.winners.length > 1
  const holeSize = variant.game === "holdem" ? "md" : "sm"

  const choose = (i: number) => {
    if (answered) return
    setPicked(i)
    const ok = i === TIE ? isTie : !isTie && drill.winners[0] === i
    answer(ok ? "right" : "wrong")
  }

  const onNext = () => {
    setPicked(null)
    next()
  }

  return (
    <DrillShell
      title="¿Qué mano gana?"
      question="Mirá la mesa y tocá la mano que gana. Si reparten, tocá «Empate»."
      score={inChallenge ? undefined : score}
      nextLabel={props.nextLabel}
      verdict={verdict}
      onNext={onNext}
      feedback={
        <div className="space-y-1">
          <p>
            {isTie
              ? `Reparten: ${drill.winners.map((i) => `Jugador ${i + 1}`).join(" y ")} con ${drill.hands[drill.winners[0]].name}.`
              : `Gana el Jugador ${drill.winners[0] + 1} con ${drill.hands[drill.winners[0]].name}.`}
          </p>
          {variant.game !== "holdem" && <p className="text-muted-foreground">{GAMES[variant.game].rule}</p>}
          <p className="text-muted-foreground">Las cartas resaltadas son las 5 que forman cada mano.</p>
        </div>
      }
    >
      <div>
        <Label>Mesa</Label>
        <CardRow cards={drill.board} />
      </div>

      <div className="space-y-2">
        {drill.holes.map((hole, i) => {
          const won = drill.winners.includes(i)
          const hand = drill.hands[i]
          return (
            <button
              key={i}
              type="button"
              disabled={answered}
              onClick={() => choose(i)}
              className={cn(
                "w-full text-left rounded-lg border p-2 transition-colors",
                !answered && "hover:bg-muted active:bg-muted",
                answered && won && "border-amber-400 bg-amber-400/10",
                answered && picked === i && !won && "border-rose-500 bg-rose-500/10",
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium flex items-center gap-1">
                  Jugador {i + 1}
                  {answered && won && <Trophy className="w-3.5 h-3.5 text-amber-400" />}
                </span>
                {answered && <span className="text-xs text-muted-foreground">{hand.name}</span>}
              </div>
              <CardRow cards={hole} size={holeSize} used={answered ? hand.fromHole : undefined} />
              {answered && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] uppercase text-muted-foreground">Juega</span>
                  <CardRow cards={hand.cards} size="xs" />
                </div>
              )}
            </button>
          )
        })}
      </div>

      <Button
        variant="outline"
        className={cn(
          "w-full",
          answered && isTie && "border-amber-400",
          answered && picked === TIE && !isTie && "border-rose-500",
        )}
        disabled={answered}
        onClick={() => choose(TIE)}
      >
        Empate (reparten)
      </Button>
    </DrillShell>
  )
}
