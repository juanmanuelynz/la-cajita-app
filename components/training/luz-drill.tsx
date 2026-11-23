"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { makeLuz, type LuzDrill as LuzData } from "@/lib/poker/drills"
import { cn } from "@/lib/utils"
import { CardRow } from "./playing-card"
import { DrillShell, Label, pct, pesos, useDrill, type DrillProps } from "./drill-shell"

type Choice = "fold" | "check" | "bet" | "call"

/** Orden en que se habla en una mesa con luz: 1º, 2º… y el que reparte último. */
function LuzSeats({ d }: { d: LuzData }) {
  const seats = Array.from({ length: d.players }, (_, i) => i + 1)
  const state = (s: number) => {
    if (s === d.seat) return "vos"
    if (!d.bet) return s < d.seat ? "check" : ""
    if (s === d.bet.seat) return "apuesta"
    if (s < d.bet.seat) return "check"
    if (s < d.seat) return "fold"
    return ""
  }
  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {seats.map((s) => (
          <div
            key={s}
            className={cn(
              "flex-1 rounded border py-1 text-center text-[11px] leading-tight",
              s === d.seat && "border-amber-400 bg-amber-400/15 font-semibold",
              d.bet?.seat === s && "border-rose-500 bg-rose-500/10",
              state(s) === "fold" && "opacity-50 line-through",
            )}
          >
            {s === d.players ? "Reparte" : `${s}º`}
            <div className="text-[10px] text-muted-foreground no-underline">{state(s) || " "}</div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">Habla primero el de la izquierda del que reparte; el que reparte habla último.</p>
    </div>
  )
}

export function LuzDrill(props: DrillProps<LuzData>) {
  const { variant } = props
  const { drill, verdict, score, answer, next, inChallenge } = useDrill("luz", props, makeLuz)
  const [picked, setPicked] = useState<Choice | null>(null)

  if (!drill) return null
  const answered = verdict !== null
  const bet = drill.bet
  const size = variant.game === "holdem" ? "md" : "sm"

  const choose = (c: Choice) => {
    setPicked(c)
    if (!bet) answer(c === "fold" ? "wrong" : "right")
    else if (bet.close) answer("close")
    else answer((c === "call") === bet.shouldCall ? "right" : "wrong")
  }

  const options: { id: Choice; label: string }[] = bet
    ? [
        { id: "fold", label: "Fold" },
        { id: "call", label: `Call ${pesos(bet.amount)}` },
      ]
    : [
        { id: "fold", label: "Fold" },
        { id: "check", label: "Check" },
        { id: "bet", label: "Apuesto" },
      ]
  const isRight = (c: Choice) => (!bet ? c !== "fold" : bet.close || (c === "call") === bet.shouldCall)

  return (
    <DrillShell
      title="Antes del flop · con luz"
      question={
        <div className="rounded-lg bg-muted/50 p-3 space-y-1">
          <div className="flex justify-between">
            <span>
              Luz de {pesos(drill.luz)} × {drill.players} jugadores
            </span>
            <b className="tabular-nums">{pesos(drill.pot)}</b>
          </div>
          {bet ? (
            <>
              <div className="flex justify-between">
                <span>El {bet.seat}º apuesta</span>
                <b className="tabular-nums">{pesos(bet.amount)}</b>
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                Antes del flop. Para practicar ves su mano y el resto hace fold: queda entre vos y él.
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground pt-1">Antes del flop. Hasta vos, todos hicieron check. ¿Qué hacés?</p>
          )}
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
        bet ? (
          <div className="space-y-2">
            <p>
              Con call ponés {pesos(bet.amount)} para ganar {pesos(drill.pot + bet.amount)} (las luces más su apuesta). Te conviene
              si ganás al menos {pesos(bet.amount)} ÷ {pesos(drill.pot + 2 * bet.amount)} = <b>{pct(bet.needed)}</b> de las
              veces.
            </p>
            <p>
              Mano a mano contra su mano ganás el <b>{pct(bet.equity)}</b> (simulando{" "}
              {bet.samples.toLocaleString("es-AR")} mesas, empates a medias).
            </p>
            <p className="font-medium">
              {pct(bet.equity)} {bet.equity >= bet.needed ? "≥" : "<"} {pct(bet.needed)} →{" "}
              {bet.close ? "es casi lo mismo: da igual." : bet.shouldCall ? "conviene call." : "conviene fold."}
            </p>
            <p className="text-muted-foreground">
              Con luz el pozo ya arranca con plata, así que para hacer call alcanza con menos chances que si estuviera vacío.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p>
              Nadie apostó: con check ves el flop sin poner un peso más. <b>Hacer fold es regalar tu luz</b> ({pesos(drill.luz)})
              sin necesidad.
            </p>
            <p className="text-muted-foreground">
              Si conviene check o apostar depende de tu mano y de la mesa; eso no lo evaluamos acá.
            </p>
          </div>
        )
      }
    >
      <LuzSeats d={drill} />
      <div>
        <Label>Tu mano</Label>
        <CardRow cards={drill.hero} size={size} />
      </div>
      {bet && (
        <div>
          <Label>Su mano</Label>
          <CardRow cards={bet.villain} size={size} />
        </div>
      )}
      <div className={cn("grid gap-2", bet ? "grid-cols-2" : "grid-cols-3")}>
        {options.map((o) => (
          <Button
            key={o.id}
            variant="outline"
            disabled={answered}
            onClick={() => choose(o.id)}
            className={cn(
              "disabled:opacity-100",
              answered && isRight(o.id) && "border-emerald-500 bg-emerald-500/10",
              answered && picked === o.id && !isRight(o.id) && "border-rose-500 bg-rose-500/10",
            )}
          >
            {o.label}
          </Button>
        ))}
      </div>
    </DrillShell>
  )
}
