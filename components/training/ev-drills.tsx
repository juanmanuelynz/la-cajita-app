"use client"

import { useState, type ReactNode } from "react"
import {
  makeBetOrCheck,
  makeCallDown,
  makeSemiBluff,
  makeShove,
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

// ── 1. ¿Apostar o pasar? ────────────────────────────────────────────────────

export function BetOrCheckDrill(props: DrillProps<BetOrCheckData>) {
  const { drill, verdict, score, answer, next, inChallenge } = useDrill("betOrCheck", props, makeBetOrCheck)
  const [picked, setPicked] = useState<"bet" | "check" | null>(null)

  if (!drill) return null
  const answered = verdict !== null
  const { pot, bet, fold, call, raise, eqCheck, eqCall, evCheck, evBet } = drill
  const winCalled = eqCall * (pot + 2 * bet) - bet

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
            <p className="text-xs text-muted-foreground">El rival pasó y hablás vos. Ya no salen más cartas.</p>
          </div>
          <div className="rounded-lg border p-3 space-y-1">
            <div className="font-semibold">Si pasás</div>
            <p>
              Se ven las cartas y ganás el <b>{pct(eqCheck, 0)}</b> de las veces.
            </p>
          </div>
          <div className="rounded-lg border p-3 space-y-1">
            <div className="font-semibold">
              Si apostás {pesos(bet)} <span className="font-normal text-muted-foreground">({drill.sizeName})</span>
            </div>
            <Row label="Hace fold" value={pct(fold, 0)} />
            <Row
              label={
                <>
                  Paga <span className="text-muted-foreground">(y ganás el {pct(eqCall, 0)})</span>
                </>
              }
              value={pct(call, 0)}
            />
            {raise > 0 && (
              <Row
                label={
                  <>
                    Te sube <span className="text-muted-foreground">(y foldeás)</span>
                  </>
                }
                value={pct(raise, 0)}
              />
            )}
          </div>
        </div>
      }
      headline={
        <Stats
          items={[
            { label: "pasando ganás", value: avg(evCheck), tone: drill.shouldBet ? "neutral" : "good" },
            { label: "apostando ganás", value: avg(evBet), tone: drill.shouldBet ? "good" : "neutral" },
          ]}
        />
      }
      feedback={
        <div className="space-y-2">
          <p>
            <b>Pasando:</b> {pct(eqCheck, 0)} × {pesos(pot)} = <b>{avg(evCheck)}</b> en promedio.
          </p>
          <p>
            <b>Apostando</b>, sumá cada respuesta del rival por lo que pasa:
          </p>
          <ul className="list-disc space-y-0.5 pl-5">
            <li>
              Fold ({pct(fold, 0)}): ganás el pozo, {pesos(pot)} <span className="whitespace-nowrap">→ {avg(fold * pot)}</span>
            </li>
            <li>
              Call ({pct(call, 0)}): ganás {pesos(pot + bet)} el {pct(eqCall, 0)} y perdés {pesos(bet)} el resto ={" "}
              {avg(winCalled)} <span className="whitespace-nowrap">→ {avg(call * winCalled)}</span>
            </li>
            {raise > 0 && (
              <li>
                Sube ({pct(raise, 0)}): perdés tu apuesta, <span className="whitespace-nowrap">−{pesos(bet)}</span> <span className="whitespace-nowrap">→ {avg(-raise * bet)}</span>
              </li>
            )}
          </ul>
          <p>
            Total: <b>{avg(evBet)}</b>. {drill.shouldBet ? "Apostar" : "Pasar"} gana {avg(Math.abs(evBet - evCheck))} más
            por mano.
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

// ── 2. Defender contra proyectos ──────────────────────────────────────────

export function SemiBluffDrill(props: DrillProps<SemiBluffData>) {
  const { drill, verdict, score, answer, next, inChallenge } = useDrill("semiBluff", props, makeSemiBluff)
  const [picked, setPicked] = useState<number | null>(null)

  if (!drill) return null
  const answered = verdict !== null
  const { pot, bet, checkShare: s, drawEquity: q, defend, plainMdf, type } = drill
  const draw = type === "draw"

  return (
    <DrillShell
      title="Defender contra proyectos"
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
            <Row label={draw ? "Pozo en el turn" : "Pozo en el river"} value={pesos(pot)} />
            <Row label="El rival va all-in por" value={pesos(bet)} />
            <p className="text-xs text-muted-foreground pt-1">
              Es {drill.sizeName}. {draw ? "Falta el river." : "Ya no salen más cartas."} No podés subir: pagás o foldeás.
            </p>
          </div>
          <p>
            {draw ? (
              <>
                Sus bluffs son <b>proyectos</b>: si le pagás, igual ganan el <b>{pct(q, 0)}</b> de las veces con el river. Y
                si en vez de apostar pasaran, se llevarían en promedio el {pct(s, 0)} del pozo.
              </>
            ) : (
              <>
                Sus bluffs no son aire: si en vez de apostar pasaran, ganarían en el showdown el <b>{pct(s, 0)}</b> de las
                veces. Si le pagás, pierden siempre.
              </>
            )}
          </p>
          <p>
            Para que a esos bluffs les dé lo mismo apostar que pasar, ¿con qué parte de tus manos tenés que <b>pagar</b>?
          </p>
        </div>
      }
      headline={
        <div className="space-y-3">
          <Stats
            items={[
              { label: "defensa de siempre", value: pct(plainMdf, 0) },
              { label: "acá alcanza con", value: pct(defend, 0), tone: "good" },
            ]}
          />
          <Split
            left={defend}
            right={1 - defend}
            leftLabel={`Pagás ${pct(defend, 0)}`}
            rightLabel={`Foldeás ${pct(1 - defend, 0)}`}
            leftClass="bg-emerald-500"
            rightClass="bg-rose-500/70"
          />
        </div>
      }
      feedback={
        <div className="space-y-2">
          <p>
            Contra un bluff puro tendrías que pagar pozo ÷ (pozo + apuesta) = {pesos(pot)} ÷ {pesos(pot + bet)} ={" "}
            {pct(plainMdf, 0)}. Pero acá el rival no compara apostar contra perder todo: lo compara contra pasar, que ya le
            deja {pct(s, 0)} × {pesos(pot)} = {avg(s * pot)}.
          </p>
          {draw ? (
            <p>
              Y cuando lo pagás no pierde siempre: arriesga menos que un bluff puro. Igualando apostar con pasar: pagar ={" "}
              (1 − {pct(s, 0)}) × {pesos(pot)} ÷ ({pesos(pot + bet)} − {pct(q, 0)} × {pesos(pot + 2 * bet)}) ={" "}
              <b>{pct(defend, 0)}</b>.
            </p>
          ) : (
            <p>
              Solo cuentan las manos que le ganan a su bluff: el {pct(1 - s, 0)} de tus manos. Defendé la parte de
              siempre de esas: {pct(1 - s, 0)} × {pct(plainMdf, 0)} = <b>{pct(defend, 0)}</b>.
            </p>
          )}
          <p className="text-muted-foreground">
            Por eso contra bluffs con chances se puede pagar menos que la defensa mínima. Vale igual en Hold&apos;em, Omaha
            y Manhattan.
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
            {o}%
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
  const signed = (n: number) => (n < 0 ? `−${pesos(-n)}` : `+${pesos(n)}`)
  const veces = (n: number) => `${n} ${n === 1 ? "vez" : "veces"}`

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
  const { sizes, defends, left, question: q } = drill
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
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            {sizes.map((s, i) => (
              <Row key={i} label={`${STREET_LABELS[i]}: apostás`} value={s.name} />
            ))}
            <p className="text-xs text-muted-foreground pt-1">
              El rival paga las tres y nunca sube. Supongamos que en cada calle sigue con lo justo: su defensa mínima.
            </p>
          </div>
          <p>
            {q === "left" ? (
              <>
                De todas las manos con las que llegó al flop, ¿qué parte <b>sigue en el river</b>?
              </>
            ) : (
              <>
                En el flop, el <b>{pct(strong, 0)}</b> de sus manos ya eran muy fuertes (por ejemplo, color hecho) y esas
                nunca foldean. De lo que llega al river, ¿qué parte son <b>esas manos</b>?
              </>
            )}
          </p>
        </div>
      }
      headline={
        <div className="space-y-3">
          <Stats
            items={[
              { label: "llega al river", value: pct(left, 0), tone: q === "left" ? "good" : "neutral" },
              ...(q === "strong" ? [{ label: "son manos fuertes", value: pct(strong / left, 0), tone: "good" as const }] : []),
            ]}
          />
          {q === "strong" && (
            <Split
              left={strong / left}
              right={1 - strong / left}
              leftLabel={`Fuertes ${pct(strong / left, 0)}`}
              rightLabel={`Resto ${pct(1 - strong / left, 0)}`}
              leftClass="bg-rose-500/80"
              rightClass="bg-emerald-500"
            />
          )}
        </div>
      }
      feedback={
        <div className="space-y-2">
          <p>Contra cada apuesta, la defensa mínima es pozo ÷ (pozo + apuesta) = 1 ÷ (1 + tamaño):</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {sizes.map((s, i) => (
              <li key={i}>
                {STREET_LABELS[i]}, {s.name}: sigue con el <b>{pct(defends[i], 0)}</b>
              </li>
            ))}
          </ul>
          <p>
            Como cada calle se aplica sobre lo que quedó de la anterior, se multiplican: {defends.map((m) => pct(m, 0)).join(" × ")}{" "}
            = <b>{pct(left, 0)}</b> de su rango del flop.
          </p>
          {q === "strong" && (
            <p>
              Las manos fuertes no se van nunca: siguen siendo el {pct(strong, 0)} del rango del flop, pero ahora sobre un
              total de {pct(left, 0)}. {pct(strong, 0)} ÷ {pct(left, 0)} = <b>{pct(strong / left, 0)}</b> de lo que paga
              todo.
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
            {o}%
          </AnswerButton>
        ))}
      </div>
    </DrillShell>
  )
}
