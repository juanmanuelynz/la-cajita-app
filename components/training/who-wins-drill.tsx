"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { makeWhoWins, type WhoWinsDrill as WhoWinsData } from "@/lib/poker/drills"
import { GAMES } from "@/lib/poker/variants"
import { cn } from "@/lib/utils"
import { CardRow } from "./playing-card"
import { Felt, PickableHand } from "./table-view"
import { DrillShell, useDrill, type DrillProps } from "./drill-shell"

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
      headline={
        <div className="text-2xl font-black leading-tight">
          {isTie ? "Reparten" : `Gana el Jugador ${drill.winners[0] + 1}`}
          <div className="text-base font-semibold text-muted-foreground">{drill.hands[drill.winners[0]].name}</div>
        </div>
      }
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
      <Felt cards={drill.board} />

      <div className="space-y-2">
        {drill.holes.map((hole, i) => {
          const hand = drill.hands[i]
          return (
            <PickableHand
              key={i}
              title={`Jugador ${i + 1}`}
              detail={answered ? hand.name : undefined}
              onPick={() => choose(i)}
              answered={answered}
              correct={drill.winners.includes(i)}
              picked={picked === i}
            >
              <CardRow cards={hole} size={holeSize} used={answered ? hand.fromHole : undefined} deal={400 + i * 180} />
              {answered && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] uppercase text-muted-foreground">Juega</span>
                  <CardRow cards={hand.cards} size="xs" />
                </div>
              )}
            </PickableHand>
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
