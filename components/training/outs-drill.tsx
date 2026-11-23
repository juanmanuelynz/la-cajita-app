"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { Card } from "@/lib/poker/cards"
import type { BestHand } from "@/lib/poker/evaluator"
import { makeOuts, type OutsDrill as OutsData } from "@/lib/poker/drills"
import type { Variant } from "@/lib/poker/variants"
import { cn } from "@/lib/utils"
import { CardRow } from "./playing-card"
import { DrillShell, Label, Stats, pct, useDrill, type DrillProps } from "./drill-shell"

/** Mesa + tu mano + la del rival (a la vista, para practicar). */
export function SpotView({
  variant,
  board,
  hero,
  villain,
  heroHand,
  villainHand,
}: {
  variant: Variant
  board: readonly Card[]
  hero: readonly Card[]
  villain: readonly Card[]
  heroHand: BestHand
  villainHand: BestHand
}) {
  const size = variant.game === "holdem" ? "md" : "sm"
  return (
    <div className="space-y-3">
      <div>
        <Label>Mesa ({board.length === 3 ? "flop" : "turn"})</Label>
        <CardRow cards={board} deal={0} />
      </div>
      <div className="grid grid-cols-1 gap-3">
        <div className="rounded-lg border border-emerald-500/40 p-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">Vos</span>
            <span className="text-xs text-muted-foreground">{heroHand.name}</span>
          </div>
          <CardRow cards={hero} size={size} deal={300} />
        </div>
        <div className="rounded-lg border p-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">Rival</span>
            <span className="text-xs text-muted-foreground">{villainHand.name}</span>
          </div>
          <CardRow cards={villain} size={size} deal={300 + hero.length * 70 + 100} />
        </div>
      </div>
    </div>
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
          <Button
            key={o}
            variant="outline"
            disabled={answered}
            onClick={() => {
              setPicked(o)
              answer(o === correct ? "right" : "wrong")
            }}
            className={cn(
              "text-lg tabular-nums disabled:opacity-100",
              answered && o === correct && "border-emerald-500 bg-emerald-500/10",
              answered && picked === o && o !== correct && "border-rose-500 bg-rose-500/10",
            )}
          >
            {o}
          </Button>
        ))}
      </div>
    </DrillShell>
  )
}
