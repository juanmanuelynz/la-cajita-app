"use client"

import { useState } from "react"
import { CATEGORY_NAMES, type Cat } from "@/lib/poker/evaluator"
import { makeUsable, type UsableDrill as UsableData } from "@/lib/poker/drills"
import { GAMES } from "@/lib/poker/variants"
import { CardRow } from "./playing-card"
import { PokerTable } from "./table-view"
import { AnswerButton, DrillShell, answerTone, useDrill, type DrillProps } from "./drill-shell"

const cuantas = (n: number) => (n === 1 ? "1 carta" : `${n} cartas`)

export function UsableDrill(props: DrillProps<UsableData>) {
  const { variant } = props
  const { drill, verdict, score, answer, next, inChallenge } = useDrill("usable", props, makeUsable)
  const [picked, setPicked] = useState<Cat | null>(null)

  if (!drill) return null
  const answered = verdict !== null
  const game = GAMES[variant.game]
  const { hand, trap, hole } = drill
  const ownInHand = hand.fromHole.length
  const ownInTrap = trap ? trap.cards.filter((c) => hole.includes(c)).length : 0

  return (
    <DrillShell
      title="¿Qué tenés?"
      question={
        <>
          Con la mesa completa, ¿cuál es tu mejor jugada en <b>{game.name}</b>?
        </>
      }
      score={inChallenge ? undefined : score}
      nextLabel={props.nextLabel}
      verdict={verdict}
      onNext={() => {
        setPicked(null)
        next()
      }}
      headline={<div className="text-2xl font-black leading-tight">{hand.name}</div>}
      feedback={
        <div className="space-y-2">
          <p>
            Tenés <b>{hand.name}</b>: {cuantas(ownInHand)} de tu mano y {cuantas(5 - ownInHand)} de la mesa.
          </p>
          <CardRow cards={hand.cards} size="xs" />
          {trap && (
            <div className="space-y-1 pt-1">
              <p>
                <b>La trampa:</b> parece que tenés {trap.name}, pero para armarla usarías {cuantas(ownInTrap)} de tu mano
                y {cuantas(5 - ownInTrap)} de la mesa.
              </p>
              <CardRow cards={trap.cards} size="xs" className="opacity-60" />
            </div>
          )}
          <p className="text-muted-foreground">{game.rule}</p>
        </div>
      }
    >
      <PokerTable
        board={drill.board}
        boardLabel="River"
        bottom={[{ key: "vos", name: "Vos", hero: true, cards: hole, used: answered ? hand.fromHole : undefined, deal: 400 }]}
      />
      <div className="grid grid-cols-2 gap-3">
        {drill.options.map((c) => (
          <AnswerButton
            key={c}
            tone={answerTone(answered, { correct: c === hand.cat, picked: picked === c })}
            onClick={() => {
              setPicked(c)
              answer(c === hand.cat ? "right" : "wrong")
            }}
          >
            {CATEGORY_NAMES[c]}
          </AnswerButton>
        ))}
      </div>
    </DrillShell>
  )
}
