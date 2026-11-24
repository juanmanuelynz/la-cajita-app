"use client"

import { useCallback, useState } from "react"
import { cardLabel } from "@/lib/poker/cards"
import { gridClasses, describeClass, type HandClass } from "@/lib/poker/preflop"
import {
  SEATS6,
  VS_SOURCE_UPDATED,
  classActions,
  findVsSpot,
  makePreflopVs,
  type PreflopVsDrill as VsData,
  type Seat6,
  type VsAction,
  type VsSpot,
} from "@/lib/poker/preflop-vs"
import { cn } from "@/lib/utils"
import { RingTable, type RingSeat } from "./table-view"
import { AnswerButton, DrillShell, answerTone, pct, useDrill, type DrillProps } from "./drill-shell"

/** Nombre corto en la mesa (6 jugadores). */
const SEAT_LABEL: Record<Seat6, string> = {
  UTG: "1º",
  MP: "2º",
  CO: "3º",
  BU: "Reparte",
  SB: "C. chica",
  BB: "C. grande",
}
/** "Estás …" */
const SEAT_WHERE: Record<Seat6, string> = {
  UTG: "hablando 1º",
  MP: "hablando 2º",
  CO: "hablando 3º",
  BU: "repartiendo",
  SB: "en la ciega chica",
  BB: "en la ciega grande",
}
/** Quién subió: "el 2º", "el que reparte"… */
const SEAT_WHO: Record<Seat6, string> = {
  UTG: "el 1º",
  MP: "el 2º",
  CO: "el 3º",
  BU: "el que reparte",
  SB: "la ciega chica",
  BB: "la ciega grande",
}

/** "de" + quién: "del 2º", "de la ciega chica". */
const ofWho = (s: Seat6) => (SEAT_WHO[s].startsWith("el ") ? `del ${SEAT_WHO[s].slice(3)}` : `de ${SEAT_WHO[s]}`)

const ACTION_NAMES: Record<VsAction, string> = { fold: "Fold", call: "Call", raise: "Resubo" }

/** Las líneas de la fuente, en castellano. */
const LABEL_TEXT: Record<string, string> = {
  Call: "pagar",
  "3-Bet/Fold": "resubir (3-bet) y, si te vuelven a subir, fold",
  "3-Bet/5-Bet": "resubir (3-bet) y, si te vuelven a subir, ir all-in",
  "3-Bet/Call": "resubir (3-bet) y, si te vuelven a subir, pagar",
  "4-Bet/Fold": "resubir otra vez (4-bet) y, si van all-in, fold",
  "4-Bet/Call": "resubir otra vez (4-bet) y, si van all-in, pagar",
}

const COLORS: Record<VsAction, string> = { raise: "#059669", call: "#0284c7", fold: "transparent" }

/** Grilla 13×13 con lo que hace la fuente con cada mano; partida cuando depende de los palos. */
function VsRangeGrid({ spot, highlight }: { spot: VsSpot; highlight: HandClass }) {
  const grid = gridClasses("long")
  let raise = 0
  let call = 0
  for (const a of spot.actions.values()) {
    if (a === "raise") raise++
    else call++
  }
  return (
    <div className="space-y-1.5">
      <div className="grid gap-px overflow-hidden rounded bg-border" style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}>
        {grid.flat().map((h) => {
          const by = classActions(spot, h)
          const n = by.raise.length + by.call.length + by.fold.length
          const r = (by.raise.length / n) * 100
          const c = (by.call.length / n) * 100
          const played = by.raise.length + by.call.length > 0
          return (
            <div
              key={h}
              title={`${h}: ${[by.raise.length && `resube ${by.raise.length}`, by.call.length && `paga ${by.call.length}`, by.fold.length && `fold ${by.fold.length}`].filter(Boolean).join(", ")} de ${n}`}
              style={
                played
                  ? {
                      background: `linear-gradient(to right, ${COLORS.raise} 0 ${r}%, ${COLORS.call} ${r}% ${r + c}%, var(--muted) ${r + c}% 100%)`,
                    }
                  : undefined
              }
              className={cn(
                "flex aspect-square items-center justify-center text-[8px] font-medium leading-none tabular-nums",
                played ? "text-white" : "bg-muted text-muted-foreground",
                h === highlight && "z-10 font-bold ring-2 ring-inset ring-amber-400",
              )}
            >
              {h.length === 2 ? h : h.slice(0, 2)}
            </div>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.raise }} /> Resube ({raise} comb.)
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.call }} /> Paga ({call} comb.)
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-muted" /> Fold
        </span>
        <span className="text-muted-foreground">Partida: depende de los palos.</span>
      </div>
    </div>
  )
}

/** Los lugares de la mesa: quién subió, quién se fue y dónde estás vos. */
function vsSeats(d: VsData): RingSeat[] {
  const hi = SEATS6.indexOf(d.hero)
  const vi = SEATS6.indexOf(d.villain)
  return SEATS6.map((s, i) => {
    const base = { key: s, label: SEAT_LABEL[s], dealer: s === "BU" }
    if (s === d.hero) return { ...base, hero: true, cards: d.cards, chip: d.situation === "vs3bet" ? (true as const) : undefined }
    if (s === d.villain)
      return {
        ...base,
        action: { kind: "bet" as const, text: d.situation === "vsOpen" ? "Sube" : "Resube" },
        chip: true as const,
      }
    // Contra una subida, los que hablan después que vos todavía no hablaron (las ciegas ya pusieron).
    if (d.situation === "vsOpen" && i > hi && i > vi) return { ...base, chip: s === "SB" || s === "BB" ? (true as const) : undefined }
    return { ...base, action: { kind: "fold" as const, text: "Fold" } }
  })
}

/** "A♠A♣, A♦A♥" */
const combos = (list: number[][]) => list.map((p) => p.map(cardLabel).join("")).join(", ")

export function PreflopVsDrill(props: DrillProps<VsData> & { situation?: "vsOpen" | "vs3bet" }) {
  const situation = props.situation ?? "vsOpen"
  const make = useCallback(() => makePreflopVs(situation), [situation])
  const { drill, verdict, score, answer, next, inChallenge } = useDrill("preflopVs", props, make)
  const [picked, setPicked] = useState<VsAction | null>(null)

  if (!drill) return null
  const spot = findVsSpot(drill)
  const answered = verdict !== null
  const by = classActions(spot, drill.hand)
  const choose = (a: VsAction) => {
    setPicked(a)
    answer(a === drill.answer ? "right" : "wrong")
  }
  const def = spot.defending.combos

  return (
    <DrillShell
      title={drill.situation === "vsOpen" ? "Antes del flop · te suben" : "Antes del flop · te resuben"}
      question={
        drill.situation === "vsOpen" ? (
          <>
            Mesa de 6, con ciegas. Estás <b>{SEAT_WHERE[drill.hero]}</b>: {SEAT_WHO[drill.villain]} subió y los demás que
            hablaron hicieron fold. ¿Qué hacés?
          </>
        ) : (
          <>
            Mesa de 6, con ciegas. Subiste <b>{SEAT_WHERE[drill.hero]}</b> y {SEAT_WHO[drill.villain]} te resubió (3-bet);
            el resto hizo fold. ¿Qué hacés?
          </>
        )
      }
      score={inChallenge ? undefined : score}
      nextLabel={props.nextLabel}
      verdict={verdict}
      onNext={() => {
        setPicked(null)
        next()
      }}
      headline={
        <div className="text-2xl font-black leading-tight">
          {ACTION_NAMES[drill.answer]}
          <div className="text-base font-semibold text-muted-foreground">
            {drill.label ? `La fuente: ${LABEL_TEXT[drill.label] ?? drill.label}` : "No está entre las manos que se juegan acá"}
          </div>
        </div>
      }
      feedback={
        <div className="space-y-2">
          <p>
            Con {describeClass(drill.hand)} ({drill.cards.map(cardLabel).join(" ")}).{" "}
            {drill.situation === "vsOpen"
              ? `Contra la subida ${ofWho(drill.villain)}, ${SEAT_WHERE[drill.hero]}`
              : `Si abriste ${SEAT_WHERE[drill.hero]} y te resube ${SEAT_WHO[drill.villain]},`}{" "}
            la fuente sigue con {def} combinaciones ({pct(def / 1326, 0)} de las manos) y el resto, fold.
          </p>
          {drill.mixed && (
            <p className="rounded-lg bg-amber-500/10 p-2">
              <b>Ojo, depende de los palos.</b> Con esta mano la fuente no hace siempre lo mismo:{" "}
              {by.raise.length > 0 && <>resube con {combos(by.raise)}</>}
              {by.raise.length > 0 && by.call.length > 0 && "; "}
              {by.call.length > 0 && <>paga con {combos(by.call)}</>}
              {by.fold.length > 0 && (by.raise.length > 0 || by.call.length > 0) && "; "}
              {by.fold.length > 0 && <>fold con {combos(by.fold)}</>}. Es a propósito: si pagaras siempre sin ases ni
              reyes, el rival sabría que cuando pagás no los tenés.
            </p>
          )}
          <VsRangeGrid spot={spot} highlight={drill.hand} />
          <p className="text-[11px] text-muted-foreground">
            Fuente:{" "}
            <a href={spot.url} target="_blank" rel="noreferrer" className="underline">
              PokerStrategy.com
            </a>
            , «{spot.source}» (Hold&apos;em No-Limit 6 jugadores, contra un rival estándar de NL200; actualizado el{" "}
            {VS_SOURCE_UPDATED.split("-").reverse().join("/")}).
          </p>
        </div>
      }
    >
      <RingTable seats={vsSeats(drill)} center={<span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Antes del flop</span>} />
      <div className="grid grid-cols-3 gap-2">
        {(["fold", "call", "raise"] as const).map((a) => (
          <AnswerButton
            key={a}
            tone={answerTone(answered, { correct: a === drill.answer, picked: picked === a })}
            onClick={() => choose(a)}
          >
            {ACTION_NAMES[a]}
          </AnswerButton>
        ))}
      </div>
    </DrillShell>
  )
}
