"use client"

import { useState, type ReactNode } from "react"
import { alpha, bluffShare, makeGto, mdf, type GtoDrill as GtoData } from "@/lib/poker/gto"
import { cn } from "@/lib/utils"
import { DrillShell, Stats, pct, pesos, useDrill, type DrillProps } from "./drill-shell"

const TITLES: Record<GtoData["question"], string> = {
  defend: "¿Cuánto defender?",
  foldNeeded: "¿Cuándo rinde el bluff?",
  bluffShare: "¿Cuántos bluffs?",
  bluffCombos: "Armá el equilibrio",
}

function Split({ left, right, leftLabel, rightLabel, leftClass, rightClass }: {
  left: number
  right: number
  leftLabel: string
  rightLabel: string
  leftClass: string
  rightClass: string
}) {
  const total = left + right
  return (
    <div className="space-y-1">
      <div className="flex h-3 overflow-hidden rounded-full">
        <div className={leftClass} style={{ width: `${(left / total) * 100}%` }} />
        <div className={rightClass} style={{ width: `${(right / total) * 100}%` }} />
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  )
}

export function GtoDrill(props: DrillProps<GtoData>) {
  const { drill, verdict, score, answer, next, inChallenge } = useDrill("gto", props, makeGto)
  const [picked, setPicked] = useState<number | null>(null)

  if (!drill) return null
  const answered = verdict !== null
  const { pot, bet, question: q } = drill
  const a = alpha(pot, bet)
  const m = mdf(pot, bet)
  const bs = bluffShare(pot, bet)
  const isPct = q !== "bluffCombos"
  const fmt = (n: number) => (isPct ? `${n}%` : `${n}`)

  const questions: Record<GtoData["question"], ReactNode> = {
    defend: (
      <>
        El rival te apuesta. Para que no le convenga hacer bluff con cualquier cosa, ¿con qué parte de tus manos tenés que
        seguir (call o raise) <b>como mínimo</b>?
      </>
    ),
    foldNeeded: (
      <>
        Hacés bluff con una mano que pierde si te pagan. ¿Qué % de las veces tiene que hacer fold el rival para que{" "}
        <b>no pierdas plata</b>?
      </>
    ),
    bluffShare: (
      <>
        Tus manos o ganan seguro o pierden seguro. Para que al rival le dé lo mismo pagar o tirar, ¿qué % de tus apuestas
        pueden ser <b>bluffs</b>?
      </>
    ),
    bluffCombos: (
      <>
        Tenés <b>{drill.value} manos</b> que ganan seguro. ¿Cuántos bluffs podés sumar para que al rival le dé lo mismo
        pagar o tirar?
      </>
    ),
  }
  const iBet = q !== "defend"

  const explanation: Record<GtoData["question"], ReactNode> = {
    defend: (
      <p>
        Un bluff arriesga {pesos(bet)} para ganar {pesos(pot)}: le alcanza con que tires {pesos(bet)} ÷ {pesos(pot + bet)} ={" "}
        {pct(a, 0)} de las veces. Para que no gane solo, seguí con al menos pozo ÷ (pozo + apuesta) = {pesos(pot)} ÷{" "}
        {pesos(pot + bet)} = <b>{pct(m, 0)}</b> de tus manos.
      </p>
    ),
    foldNeeded: (
      <p>
        Arriesgás {pesos(bet)} para ganar {pesos(pot)}. Empata cuando apuesta ÷ (pozo + apuesta) = {pesos(bet)} ÷{" "}
        {pesos(pot + bet)} = <b>{pct(a, 0)}</b>. Si el rival tira más seguido que eso, el bluff gana plata.
      </p>
    ),
    bluffShare: (
      <p>
        El rival paga {pesos(bet)} para ganar {pesos(pot + bet)}: le da lo mismo cuando acierta {pesos(bet)} ÷{" "}
        {pesos(pot + 2 * bet)} = <b>{pct(bs, 0)}</b> de las veces. Esa es la parte de tus apuestas que puede ser bluff
        (son las mismas pot odds del ejercicio ¿Call o fold?).
      </p>
    ),
    bluffCombos: (
      <p>
        Por cada mano de valor van apuesta ÷ (pozo + apuesta) = {pesos(bet)} ÷ {pesos(pot + bet)} = {pct(a, 0)} bluffs.{" "}
        {drill.value} × {pct(a, 0)} = <b>{drill.answer}</b>. Así, de {drill.value! + drill.answer} apuestas,{" "}
        {drill.answer} son bluff ({pct(bs, 0)}).
      </p>
    ),
  }

  return (
    <DrillShell
      title={TITLES[q]}
      score={inChallenge ? undefined : score}
      nextLabel={props.nextLabel}
      verdict={verdict}
      onNext={() => {
        setPicked(null)
        next()
      }}
      question={
        <div className="space-y-3">
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <div className="flex justify-between">
              <span>Pozo en el river</span>
              <b className="tabular-nums">{pesos(pot)}</b>
            </div>
            <div className="flex justify-between">
              <span>{iBet ? "Apostás" : "El rival apuesta"}</span>
              <b className="tabular-nums">{pesos(bet)}</b>
            </div>
            <p className="text-xs text-muted-foreground pt-1">Es {drill.sizeName}. Ya no salen más cartas.</p>
          </div>
          <p>{questions[q]}</p>
        </div>
      }
      headline={
        <div className="space-y-3">
          <Stats
            items={[
              { label: "defensa mínima", value: pct(m, 0), tone: q === "defend" ? "good" : "neutral" },
              { label: "fold para el bluff", value: pct(a, 0), tone: q === "foldNeeded" ? "good" : "neutral" },
              {
                label: "apuestas de bluff",
                value: pct(bs, 0),
                tone: q === "bluffShare" || q === "bluffCombos" ? "good" : "neutral",
              },
            ]}
          />
          {q === "defend" || q === "foldNeeded" ? (
            <Split
              left={m}
              right={a}
              leftLabel={`Sigue ${pct(m, 0)}`}
              rightLabel={`Tira ${pct(a, 0)}`}
              leftClass="bg-emerald-500"
              rightClass="bg-rose-500/70"
            />
          ) : (
            <Split
              left={1 - bs}
              right={bs}
              leftLabel={`Valor ${pct(1 - bs, 0)}`}
              rightLabel={`Bluff ${pct(bs, 0)}`}
              leftClass="bg-sky-500"
              rightClass="bg-amber-500"
            />
          )}
        </div>
      }
      feedback={
        <div className="space-y-2">
          {explanation[q]}
          <p className="text-muted-foreground">
            Regla: cuanto más grande la apuesta, menos tenés que defender y más bluffs puede tener quien apuesta. Vale
            igual en Hold&apos;em, Omaha y Manhattan.
          </p>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        {drill.options.map((o) => (
          <button
            key={o}
            type="button"
            disabled={answered}
            onClick={() => {
              setPicked(o)
              answer(o === drill.answer ? "right" : "wrong")
            }}
            className={cn(
              "min-h-12 rounded-xl border bg-card text-lg font-bold tabular-nums transition-colors",
              !answered && "active:scale-[0.97] active:bg-muted",
              answered && o === drill.answer && "border-emerald-500 bg-emerald-500/10 text-emerald-500",
              answered && picked === o && o !== drill.answer && "border-rose-500 bg-rose-500/10 text-rose-500",
              answered && o !== drill.answer && picked !== o && "opacity-50",
            )}
          >
            {fmt(o)}
          </button>
        ))}
      </div>
    </DrillShell>
  )
}
