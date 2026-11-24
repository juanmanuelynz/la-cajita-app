"use client"

import { useState } from "react"
import { makeWhoWins, type WhoWinsDrill as WhoWinsData } from "@/lib/poker/drills"
import { GAMES } from "@/lib/poker/variants"
import { CardRow } from "./playing-card"
import { PokerTable, type TableSeat } from "./table-view"
import { AnswerButton, DrillShell, answerTone, useDrill, type DrillProps } from "./drill-shell"

const TIE = -1

export function WhoWinsDrill(props: DrillProps<WhoWinsData>) {
  const { variant } = props
  const { drill, verdict, score, answer, next, inChallenge } = useDrill("whoWins", props, makeWhoWins)
  const [picked, setPicked] = useState<number | null>(null)

  if (!drill) return null
  const answered = verdict !== null
  const isTie = drill.winners.length > 1

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
          <p className="text-muted-foreground">Abajo de la mesa, las 5 cartas con las que juega cada uno.</p>
        </div>
      }
    >
      {(() => {
        const seats: TableSeat[] = drill.holes.map((hole, i) => ({
          key: i,
          name: `Jugador ${i + 1}`,
          cards: hole,
          detail: answered ? drill.hands[i].name : undefined,
          used: answered ? drill.hands[i].fromHole : undefined,
          deal: 400 + i * 180,
          pick: { onPick: () => choose(i), answered, correct: drill.winners.includes(i), picked: picked === i },
        }))
        return <PokerTable top={seats.slice(0, 1)} board={drill.board} boardLabel="River" bottom={seats.slice(1)} />
      })()}

      {answered && (
        <div className="space-y-1.5 rounded-xl bg-muted/40 p-2.5">
          {drill.hands.map((hand, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-xs text-muted-foreground">Jugador {i + 1}</span>
              <CardRow cards={hand.cards} size="xs" />
            </div>
          ))}
        </div>
      )}

      <AnswerButton tone={answerTone(answered, { correct: isTie, picked: picked === TIE })} onClick={() => choose(TIE)}>
        Empate (reparten)
      </AnswerButton>
    </DrillShell>
  )
}
