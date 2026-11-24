"use client"

import { useState } from "react"
import type { Card } from "@/lib/poker/cards"
import type { BestHand } from "@/lib/poker/evaluator"
import { makeOuts, type OutsDrill as OutsData } from "@/lib/poker/drills"
import type { Variant } from "@/lib/poker/variants"
import { CardRow } from "./playing-card"
import { PokerTable, TableChip } from "./table-view"
import { AnswerButton, DrillShell, answerTone, Stats, pct, pesos, useDrill, type DrillProps } from "./drill-shell"

/** Mesa + tu mano + la del rival (a la vista, para practicar). */
export function SpotView({
  board,
  hero,
  villain,
  heroHand,
  villainHand,
  pot,
  bet,
}: {
  /** Lo reciben todos los ejercicios; acá no cambia nada. */
  variant?: Variant
  board: readonly Card[]
  hero: readonly Card[]
  villain: readonly Card[]
  heroHand: BestHand
  villainHand: BestHand
  /** En ¿Call o fold?: el pozo, en el centro de la mesa. */
  pot?: number
  /** En ¿Call o fold?: lo que apuesta el rival (ficha delante suyo). */
  bet?: number
}) {
  return (
    <PokerTable
      top={[
        {
          key: "rival",
          name: "Rival",
          cards: villain,
          detail: villainHand.name,
          deal: 300 + hero.length * 70 + 100,
          bet: bet !== undefined ? pesos(bet) : undefined,
        },
      ]}
      board={board}
      boardLabel={board.length === 3 ? "Flop" : "Turn"}
      center={pot !== undefined && <TableChip>Pozo {pesos(pot)}</TableChip>}
      bottom={[{ key: "vos", name: "Vos", hero: true, cards: hero, detail: heroHand.name, deal: 300 }]}
    />
  )
}

/** Explicación de cuánto vale cada out. */
export function OutsMath({
  variant,
  outs,
  ties,
  unseen,
  street,
}: {
  variant: Variant
  outs: readonly Card[]
  ties: readonly Card[]
  unseen: number
  street: "flop" | "turn"
}) {
  const n = outs.length
  const nextCard = street === "flop" ? "el turn" : "el river"
  return (
    <div className="space-y-2">
      <p>
        Tenés <b>{n} outs</b>: cartas que te ponen adelante en {nextCard}.
        {ties.length > 0 && ` Además ${ties.length} te dejan empatado.`}
      </p>
      <CardRow cards={outs} size="xs" />
      <p>
        Quedan {unseen} cartas en el mazo, así que la chance de ligar en {nextCard} es {n} ÷ {unseen} ={" "}
        <b>{pct(n / unseen)}</b>.
      </p>
      {variant.deck === "long" ? (
        <p className="text-muted-foreground">
          Regla rápida: outs × 2 ≈ % para una carta ({n} × 2 = {n * 2}%)
          {street === "flop" && <>; outs × 4 ≈ % hasta el river ({n} × 4 = {n * 4}%)</>}.
        </p>
      ) : (
        <p className="text-muted-foreground">
          En Short deck quedan menos cartas, así que cada out vale más: ≈ {pct(1 / unseen)} cada uno (en Long deck
          es ≈ 2%). La regla de «× 2» se queda corta acá.
        </p>
      )}
    </div>
  )
}

export function OutsDrill(props: DrillProps<OutsData>) {
  const { variant } = props
  const { drill, verdict, score, answer, next, inChallenge } = useDrill("outs", props, makeOuts)
  const [picked, setPicked] = useState<number | null>(null)

  if (!drill) return null
  const answered = verdict !== null
  const correct = drill.outs.length
  const nextCard = drill.street === "flop" ? "el turn" : "el river"

  return (
    <DrillShell
      title="Contá los outs"
      question={
        <>
          Vas perdiendo. ¿Cuántas cartas te ponen <b>adelante</b> si salen en {nextCard}?
        </>
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
            { label: "outs", value: String(correct) },
            { label: `de ligar en ${nextCard}`, value: pct(drill.nextCardPct, 0) },
          ]}
        />
      }
      feedback={
        <div className="space-y-2">
          <OutsMath variant={variant} outs={drill.outs} ties={drill.ties} unseen={drill.unseen} street={drill.street} />
          {drill.riverEquity !== undefined && (
            <p className="text-muted-foreground">
              Contando turn y river juntos (y que el rival también puede mejorar), tu chance exacta de ganar es{" "}
              <b>{pct(drill.riverEquity)}</b>.
            </p>
          )}
        </div>
      }
    >
      <SpotView {...drill} variant={variant} />
      <div className="grid grid-cols-4 gap-2">
        {drill.options.map((o) => (
          <AnswerButton
            key={o}
            tone={answerTone(answered, { correct: o === correct, picked: picked === o })}
            className="text-lg tabular-nums"
            onClick={() => {
              setPicked(o)
              answer(o === correct ? "right" : "wrong")
            }}
          >
            {o}
          </AnswerButton>
        ))}
      </div>
    </DrillShell>
  )
}
