"use client"

import { useState, type ReactNode } from "react"
import {
  makeBetOrCheck,
  makeCallDown,
  makeSemiBluff,
  makeShove,
  CALL_DOWN_SIZES,
  defendPer100,
  type BetOrCheckDrill as BetOrCheckData,
  type CallDownDrill as CallDownData,
  type SemiBluffDrill as SemiBluffData,
  type ShoveDrill as ShoveData,
} from "@/lib/poker/ev"
import { AnswerButton, DrillShell, Stats, answerTone, pct, pesos, useDrill, type DrillProps } from "./drill-shell"
import { MdfVsPotOdds, Split } from "./gto-drill"

/** Plata promedio: redondeada a $10 y con signo si es negativa. */
const avg = (n: number) => {
  const r = Math.round(n / 10) * 10
  return r < 0 ? `−${pesos(-r)}` : pesos(r)
}

function Row({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span>{label}</span>
      <b className="tabular-nums text-right">{value}</b>
    </div>
  )
}

/** Plata con signo: +$1.200 / −$800. */
const signed = (n: number) => (n < 0 ? `−${pesos(-n)}` : `+${pesos(n)}`)
const veces = (n: number) => `${n} ${n === 1 ? "vez" : "veces"}`

// ── 1. ¿Apostar o pasar? ────────────────────────────────────────────────────

export function BetOrCheckDrill(props: DrillProps<BetOrCheckData>) {
  const { drill, verdict, score, answer, next, inChallenge } = useDrill("betOrCheck", props, makeBetOrCheck)
  const [picked, setPicked] = useState<"bet" | "check" | null>(null)

  if (!drill) return null
  const answered = verdict !== null
  const { pot, bet, checkWins, folds, callWins, callLosses, raises, evCheck, evBet } = drill
  const totalCheck = evCheck * 10
  const totalBet = evBet * 10

  return (
    <DrillShell
      title="¿Apostar o pasar?"
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
            <Row label="Pozo en el river" value={pesos(pot)} />
            <p className="text-xs text-muted-foreground">
              El rival pasó y hablás vos. Ya no salen más cartas. Lo que está en el pozo ya no es de nadie: perderlo
              cuenta $0.
            </p>
          </div>
          <div className="rounded-lg border p-3 space-y-1.5">
            <div className="font-semibold">Si pasás, de cada 10 veces:</div>
            <Row label={`${veces(checkWins)} ganás el pozo`} value={`+${pesos(pot)}`} />
            <Row label={`${veces(10 - checkWins)} perdés`} value={pesos(0)} />
          </div>
          <div className="rounded-lg border p-3 space-y-1.5">
            <div className="font-semibold">
              Si apostás {pesos(bet)} <span className="font-normal text-muted-foreground">({drill.sizeName})</span>, de
              cada 10 veces:
            </div>
            <Row label={`${veces(folds)} foldea`} value={`+${pesos(pot)}`} />
            {callWins > 0 && (
              <Row
                label={
                  <>
                    {veces(callWins)} paga y ganás <span className="text-muted-foreground">(pozo + su apuesta)</span>
                  </>
                }
                value={`+${pesos(pot + bet)}`}
              />
            )}
            {callLosses > 0 && <Row label={`${veces(callLosses)} paga y perdés`} value={`−${pesos(bet)}`} />}
            {raises > 0 && (
              <Row
                label={
                  <>
                    {veces(raises)} te sube <span className="text-muted-foreground">(y foldeás)</span>
                  </>
                }
                value={`−${pesos(bet)}`}
              />
            )}
          </div>
          <p>Sumando las 10 veces, ¿qué da más?</p>
        </div>
      }
      headline={
        <Stats
          items={[
            { label: "pasando, en 10", value: signed(totalCheck), tone: drill.shouldBet ? "neutral" : "good" },
            { label: "apostando, en 10", value: signed(totalBet), tone: drill.shouldBet ? "good" : "neutral" },
          ]}
        />
      }
      feedback={
        <div className="space-y-2">
          <p>Sumá lo que pasa en las 10 veces de cada opción:</p>
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <div className="font-semibold">Pasando</div>
            <Row label={`${checkWins} × +${pesos(pot)}`} value={signed(checkWins * pot)} />
            <div className="border-t pt-1">
              <Row label="Total" value={signed(totalCheck)} />
            </div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <div className="font-semibold">Apostando</div>
            <Row label={`${folds} × +${pesos(pot)}`} value={signed(folds * pot)} />
            {callWins > 0 && <Row label={`${callWins} × +${pesos(pot + bet)}`} value={signed(callWins * (pot + bet))} />}
            {callLosses > 0 && <Row label={`${callLosses} × −${pesos(bet)}`} value={signed(-callLosses * bet)} />}
            {raises > 0 && <Row label={`${raises} × −${pesos(bet)}`} value={signed(-raises * bet)} />}
            <div className="border-t pt-1">
              <Row label="Total" value={signed(totalBet)} />
            </div>
          </div>
          <p className="font-medium">
            {drill.shouldBet ? "Apostar" : "Pasar"} da {pesos(Math.abs(totalBet - totalCheck))} más cada 10 manos (
            {avg(Math.abs(evBet - evCheck))} por mano).
          </p>
          <p className="text-muted-foreground">
            Apostar con una mano que ya gana seguido solo conviene si te pagan peores. Si las que pagan te ganan y las
            peores foldean, apostar te saca plata. Vale igual en Hold&apos;em, Omaha y Manhattan.
          </p>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        {(["check", "bet"] as const).map((c) => (
          <AnswerButton
            key={c}
            tone={answerTone(answered, { correct: (c === "bet") === drill.shouldBet, picked: picked === c })}
            amount={c === "bet" ? evBet : evCheck}
            onClick={() => {
              setPicked(c)
              answer((c === "bet") === drill.shouldBet ? "right" : "wrong")
            }}
          >
            {c === "bet" ? `Apostar ${pesos(bet)}` : "Pasar"}
          </AnswerButton>
        ))}
      </div>
    </DrillShell>
  )
}

// ── 2. Defender contra bluffs con chances (river) ─────────────────────────

export function SemiBluffDrill(props: DrillProps<SemiBluffData>) {
  const { drill, verdict, score, answer, next, inChallenge } = useDrill("semiBluff", props, makeSemiBluff)
  const [picked, setPicked] = useState<number | null>(null)

  if (!drill) return null
  const answered = verdict !== null
  const { pot, bet, beaten, counted, plainCount } = drill

  return (
    <DrillShell
      title="Defender contra bluffs con chances"
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
            <Row label="Pozo en el river" value={pesos(pot)} />
            <Row label="El rival va all-in por" value={pesos(bet)} />
            <p className="text-xs text-muted-foreground pt-1">
              Es {drill.sizeName}. Ya no salen más cartas. No podés subir: pagás o foldeás.
            </p>
          </div>
          <div className="rounded-lg border p-3 space-y-1.5">
            <p>
              Contra un bluff de aire pagarías con <b>{plainCount}</b> de tus 100 manos (su defensa mínima: pozo ÷ (pozo
              + apuesta)).
            </p>
            <p>
              Pero sus bluffs no son aire: si en vez de apostar pasaran, en el showdown le ganarían a <b>{beaten}</b> de tus
              100 manos.
            </p>
          </div>
          <p>
            De tus 100 manos, ¿con cuántas tenés que <b>pagar</b> para que a sus bluffs les dé lo mismo apostar que pasar?
          </p>
        </div>
      }
      headline={
        <div className="space-y-3">
          <Stats
            items={[
              { label: "contra aire", value: `${plainCount} de 100` },
              { label: "acá alcanza con", value: `${drill.answer} de 100`, tone: "good" },
            ]}
          />
          <Split
            left={drill.answer / 100}
            right={1 - drill.answer / 100}
            leftLabel={`Pagás con ${drill.answer}`}
            rightLabel={`Foldeás ${100 - drill.answer}`}
            leftClass="bg-emerald-500"
            rightClass="bg-rose-500/70"
          />
        </div>
      }
      feedback={
        <div className="space-y-2">
          <p>
            Las {beaten} manos a las que su bluff les gana igual no sirven para pagar: si pagás, perdés lo mismo que si
            hubiera pasado. Cuentan las otras <b>{counted}</b>.
          </p>
          <p>
            Defendé la misma parte que contra aire, pero de esas {counted}: {counted} × {plainCount} ÷ 100 ={" "}
            <b>{drill.answer}</b> de 100.
          </p>
          <p className="text-muted-foreground">
            Por eso contra bluffs con chances (los que ganan a veces sin que les paguen, o los proyectos) se puede pagar
            menos que la defensa mínima. Vale igual en Hold&apos;em, Omaha y Manhattan.
          </p>
          <MdfVsPotOdds />
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        {drill.options.map((o) => (
          <AnswerButton
            key={o}
            tone={answerTone(answered, { correct: o === drill.answer, picked: picked === o })}
            className="text-lg font-bold tabular-nums"
            onClick={() => {
              setPicked(o)
              answer(o === drill.answer ? "right" : "wrong")
            }}
          >
            {o}
          </AnswerButton>
        ))}
      </div>
    </DrillShell>
  )
}

// ── 3. ¿All-in o fold? ────────────────────────────────────────────────────

export function ShoveDrill(props: DrillProps<ShoveData>) {
  const { drill, verdict, score, answer, next, inChallenge } = useDrill("shove", props, makeShove)
  const [picked, setPicked] = useState<string | null>(null)

  if (!drill) return null
  const answered = verdict !== null
  const { pot, stack, calls, wins, total } = drill
  const folds = 10 - calls
  const losses = calls - wins

  return (
    <DrillShell
      title="¿All-in o fold?"
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
            <Row label={`Luces en el pozo (${drill.players} × ${pesos(drill.luz)})`} value={pesos(pot)} />
            <Row label="Tus fichas (sin contar tu luz)" value={pesos(stack)} />
            <p className="text-xs text-muted-foreground pt-1">
              Antes del flop y nadie apostó. Fold no te cuesta nada: tu luz ya está en el pozo.
            </p>
          </div>
          <div className="rounded-lg border p-3 space-y-1.5">
            <div className="font-semibold">Si vas all-in, de cada 10 veces:</div>
            <Row label={`${veces(folds)} foldean todos`} value={`+${pesos(pot)}`} />
            <Row
              label={
                <>
                  {veces(wins)} te pagan y ganás{" "}
                  <span className="text-muted-foreground">(luces + sus fichas)</span>
                </>
              }
              value={`+${pesos(pot + stack)}`}
            />
            <Row label={`${veces(losses)} te pagan y perdés`} value={`−${pesos(stack)}`} />
          </div>
          <p>Sumando las 10 veces, ¿te conviene el all-in o el fold?</p>
        </div>
      }
      headline={
        <Stats
          items={[
            { label: "en 10 all-ins", value: signed(total), tone: drill.shouldShove ? "good" : "bad" },
            { label: "con fold", value: pesos(0) },
          ]}
        />
      }
      feedback={
        <div className="space-y-2">
          <p>Sumá lo que pasa en las 10 veces:</p>
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <Row label={`${folds} × +${pesos(pot)}`} value={signed(folds * pot)} />
            <Row label={`${wins} × +${pesos(pot + stack)}`} value={signed(wins * (pot + stack))} />
            <Row label={`${losses} × −${pesos(stack)}`} value={signed(-losses * stack)} />
            <div className="border-t pt-1">
              <Row label="Total" value={signed(total)} />
            </div>
          </div>
          <p className="font-medium">
            {drill.shouldShove
              ? `Da positivo: conviene el all-in (${avg(drill.ev)} por vez, en promedio). El fold da $0.`
              : `Da negativo: conviene el fold, que da $0. El all-in pierde ${avg(-drill.ev)} por vez, en promedio.`}
          </p>
          <p className="text-muted-foreground">
            Las veces que foldean todos ganás sin mostrar las cartas. Por eso, cuanto más seguido foldean, menos
            necesitás ganar cuando te pagan.
          </p>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        {(["fold", "shove"] as const).map((id) => (
          <AnswerButton
            key={id}
            tone={answerTone(answered, { correct: (id === "shove") === drill.shouldShove, picked: picked === id })}
            amount={id === "shove" ? drill.ev : 0}
            onClick={() => {
              setPicked(id)
              answer((id === "shove") === drill.shouldShove ? "right" : "wrong")
            }}
          >
            {id === "shove" ? `All-in ${pesos(stack)}` : "Fold"}
          </AnswerButton>
        ))}
      </div>
    </DrillShell>
  )
}

// ── 4. ¿Qué le queda? ──────────────────────────────────────────────────────

const STREET_LABELS = ["Flop", "Turn", "River"]

export function CallDownDrill(props: DrillProps<CallDownData>) {
  const { drill, verdict, score, answer, next, inChallenge } = useDrill("callDown", props, makeCallDown)
  const [picked, setPicked] = useState<number | null>(null)

  if (!drill) return null
  const answered = verdict !== null
  const { sizes, defends, chain, left, question: q } = drill
  const strong = drill.strong ?? 0

  return (
    <DrillShell
      title="¿Qué le queda?"
      score={inChallenge ? undefined : score}
      nextLabel={props.nextLabel}
      verdict={verdict}
      onNext={() => {
        setPicked(null)
        next()
      }}
      question={
        <div className="space-y-3">
          <p>
            El rival llega al flop con <b>100 manos</b>. Apostás en las tres calles y él paga las tres, sin subir nunca:
          </p>
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            {sizes.map((s, i) => (
              <Row key={i} label={`${STREET_LABELS[i]}: apostás`} value={s.name} />
            ))}
          </div>
          <div className="rounded-lg border p-3 space-y-1">
            <div className="text-xs text-muted-foreground">
              En cada calle sigue con lo justo (su defensa mínima). Contra cada tamaño, de cada 100 manos sigue con:
            </div>
            {CALL_DOWN_SIZES.map((s) => (
              <Row key={s.name} label={s.name} value={defendPer100(s.frac)} />
            ))}
          </div>
          <p>
            {q === "left" ? (
              <>
                Calle por calle, ¿con <b>cuántas manos</b> llega al river?
              </>
            ) : (
              <>
                Llega al river con <b>{left}</b> manos. De las 100 del flop, <b>{strong}</b> ya eran color y esas nunca
                foldean. De las {left} que llegan, ¿cuántas son color?
              </>
            )}
          </p>
        </div>
      }
      headline={
        <div className="space-y-3">
          <Stats
            items={[
              { label: "llegan al river", value: `${left} de 100`, tone: q === "left" ? "good" : "neutral" },
              ...(q === "strong" ? [{ label: "son color", value: `${strong} de ${left}`, tone: "good" as const }] : []),
            ]}
          />
          {q === "strong" && (
            <Split
              left={strong / left}
              right={1 - strong / left}
              leftLabel={`Color ${strong}`}
              rightLabel={`Resto ${left - strong}`}
              leftClass="bg-rose-500/80"
              rightClass="bg-emerald-500"
            />
          )}
        </div>
      }
      feedback={
        <div className="space-y-2">
          <p>Seguí las manos calle por calle:</p>
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <Row label="Llega al flop" value="100" />
            {sizes.map((s, i) => (
              <Row
                key={i}
                label={`${STREET_LABELS[i]} (${s.name}): ${i === 0 ? 100 : chain[i - 1]} × ${defends[i]} ÷ 100`}
                value={chain[i]}
              />
            ))}
          </div>
          {q === "strong" && (
            <p>
              Las {strong} de color no se van nunca: siguen siendo {strong}, pero ahora de un total de {left}. O sea,{" "}
              <b>
                {strong} de cada {left}
              </b>{" "}
              (el {pct(strong / left, 0)} de lo que paga todo).
            </p>
          )}
          <p className="text-muted-foreground">
            Por eso, cuando alguien paga tres apuestas grandes, casi nunca tiene una mano mediocre: el bluff del river
            necesita que el rival tenga poco, y después de tres calles suele tener mucho. Vale igual en Hold&apos;em,
            Omaha y Manhattan.
          </p>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        {drill.options.map((o) => (
          <AnswerButton
            key={o}
            tone={answerTone(answered, { correct: o === drill.answer, picked: picked === o })}
            className="text-lg font-bold tabular-nums"
            onClick={() => {
              setPicked(o)
              answer(o === drill.answer ? "right" : "wrong")
            }}
          >
            {o}
          </AnswerButton>
        ))}
      </div>
    </DrillShell>
  )
}
