"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CATEGORY_NAMES, type Cat } from "@/lib/poker/evaluator"
import { makeUsable } from "@/lib/poker/drills"
import { GAMES, type Variant } from "@/lib/poker/variants"
import { cn } from "@/lib/utils"
import { CardRow } from "./playing-card"
import { DrillShell, Label, useDrill } from "./drill-shell"

const cuantas = (n: number) => (n === 1 ? "1 carta" : `${n} cartas`)

export function UsableDrill({ variant }: { variant: Variant }) {
  const { drill, verdict, score, answer, next } = useDrill(variant, makeUsable)
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
      score={score}
      verdict={verdict}
      onNext={() => {
        setPicked(null)
        next()
      }}
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
      <div>
        <Label>Mesa</Label>
        <CardRow cards={drill.board} />
      </div>
      <div>
        <Label>Tu mano</Label>
        <CardRow cards={hole} size={variant.game === "holdem" ? "md" : "sm"} used={answered ? hand.fromHole : undefined} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {drill.options.map((c) => (
          <Button
            key={c}
            variant="outline"
            disabled={answered}
            onClick={() => {
              setPicked(c)
              answer(c === hand.cat ? "right" : "wrong")
            }}
            className={cn(
              "disabled:opacity-100",
              answered && c === hand.cat && "border-emerald-500 bg-emerald-500/10",
              answered && picked === c && c !== hand.cat && "border-rose-500 bg-rose-500/10",
            )}
          >
            {CATEGORY_NAMES[c]}
          </Button>
        ))}
      </div>
    </DrillShell>
  )
}
