"use client"

import { useState, type ReactNode } from "react"
import {
  makeBetOrCheck,
  makeSemiBluff,
  makeShove,
  type BetOrCheckDrill as BetOrCheckData,
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
  const { pot, stack, callChance: c, needed, question: q } = drill
  const foldChance = 1 - c

  const pick = (id: string, ok: boolean) => {
    setPicked(id)
    answer(ok ? "right" : "wrong")
  }

  return (
    <DrillShell
      title={q === "needed" ? "¿Cuánto tenés que ganar?" : "¿All-in o fold?"}
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
            <Row label={`Luz de ${drill.players} jugadores`} value={pesos(pot)} />
            <Row label="Te quedan (además de tu luz)" value={pesos(stack)} />
            <p className="text-xs text-muted-foreground pt-1">
              Antes del flop. Nadie apostó todavía y vas all-in por {pesos(stack)}.
            </p>
          </div>
          <p>
            Foldean todos el <b>{pct(foldChance, 0)}</b> de las veces. El resto, te paga uno
            {q === "decide" && drill.equity !== undefined && (
              <>
                {" "}
                y contra sus manos ganás el <b>{pct(drill.equity, 0)}</b>
              </>
            )}
            .
          </p>
          <p>
            {q === "needed" ? (
              <>
                ¿Qué % de las veces tenés que ganar <b>cuando te pagan</b> para que el all-in no pierda plata?
              </>
            ) : (
              <>¿All-in o fold?</>
            )}
          </p>
        </div>
      }
      headline={
        <Stats
          items={[
            { label: "necesitás ganar", value: pct(needed, 0), tone: q === "needed" ? "good" : "neutral" },
            ...(q === "decide" && drill.equity !== undefined
              ? [{ label: "ganás", value: pct(drill.equity, 0), tone: drill.shouldShove ? ("good" as const) : ("bad" as const) }]
              : [{ label: "pot odds sin folds", value: pct(stack / (pot + 2 * stack), 0) }]),
          ]}
        />
      }
      feedback={
        <div className="space-y-2">
          <p>Hacer fold vale $0 (tu luz ya está en el pozo). El all-in tiene tres finales:</p>
          <ul className="list-disc space-y-0.5 pl-5">
            <li>
              Foldean todos ({pct(foldChance, 0)}): ganás las luces, +{pesos(pot)}
            </li>
            <li>
              Te pagan y ganás: +{pesos(pot + stack)} (las luces y sus fichas)
            </li>
            <li>Te pagan y perdés: −{pesos(stack)}</li>
          </ul>
          <p>
            Para no perder plata: {pct(foldChance, 0)} × {pesos(pot)} + {pct(c, 0)} × (ganás × {pesos(pot + 2 * stack)} −{" "}
            {pesos(stack)}) = 0 → ganás = <b>{pct(needed, 0)}</b>.
          </p>
          {q === "decide" && drill.equity !== undefined && drill.ev !== undefined && (
            <p className="font-medium">
              {pct(drill.equity, 0)} {drill.shouldShove ? "≥" : "<"} {pct(needed, 0)} →{" "}
              {drill.shouldShove ? "conviene el all-in" : "conviene fold"} (el all-in da {avg(drill.ev)} en promedio).
            </p>
          )}
          <p className="text-muted-foreground">
            Sin los folds necesitarías {pesos(stack)} ÷ {pesos(pot + 2 * stack)} = {pct(stack / (pot + 2 * stack), 0)}: las
            veces que foldean todos bajan lo que tenés que ganar. Cuanto menos fichas te quedan, más pesan las luces.
          </p>
        </div>
      }
    >
      {q === "needed" ? (
        <div className="grid grid-cols-2 gap-3">
          {drill.options!.map((o) => (
            <AnswerButton
              key={o}
              tone={answerTone(answered, { correct: o === drill.answer, picked: picked === String(o) })}
              className="text-lg font-bold tabular-nums"
              onClick={() => pick(String(o), o === drill.answer)}
            >
              {o}%
            </AnswerButton>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {(["fold", "shove"] as const).map((id) => (
            <AnswerButton
              key={id}
              tone={answerTone(answered, { correct: (id === "shove") === drill.shouldShove, picked: picked === id })}
              amount={id === "shove" ? drill.ev : 0}
              onClick={() => pick(id, (id === "shove") === drill.shouldShove)}
            >
              {id === "shove" ? `All-in ${pesos(stack)}` : "Fold"}
            </AnswerButton>
          ))}
        </div>
      )}
    </DrillShell>
  )
}
