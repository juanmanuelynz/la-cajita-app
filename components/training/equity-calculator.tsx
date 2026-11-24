"use client"

import { useEffect, useMemo, useState } from "react"
import { Minus, Plus, Shuffle, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card as UICard, CardContent } from "@/components/ui/card"
import { ChipSpinner } from "@/components/poker-chip"
import { RANK_LABELS, SUITS, makeDeck, rankOf, remainingDeck, shuffle, suitOf, type Card } from "@/lib/poker/cards"
import { bestHand } from "@/lib/poker/evaluator"
import { computeEquityAsync, type EquityResult } from "@/lib/poker/equity"
import { GAMES, maxPlayers, type Variant } from "@/lib/poker/variants"
import { cn } from "@/lib/utils"
import { CARD_FACE, CARD_RANK_FONT, EmptyCard, PlayingCard, SUIT_TEXT } from "./playing-card"
import { Label, pct } from "./drill-shell"

type Slot = { kind: "player"; p: number; i: number } | { kind: "board"; i: number }
type Slots = { players: (Card | null)[][]; board: (Card | null)[] }

const emptySlots = (v: Variant, n: number): Slots => ({
  players: Array.from({ length: n }, () => new Array(GAMES[v.game].holeCount).fill(null)),
  board: new Array(5).fill(null),
})

const sameSlot = (a: Slot | null, b: Slot) =>
  !!a && a.kind === b.kind && a.i === b.i && (a.kind === "board" || (b.kind === "player" && a.p === b.p))

export function EquityCalculator({ variant }: { variant: Variant }) {
  const [slots, setSlots] = useState<Slots>(() => emptySlots(variant, 2))
  const [active, setActive] = useState<Slot | null>({ kind: "player", p: 0, i: 0 })
  const [result, setResult] = useState<EquityResult | null>(null)
  const [running, setRunning] = useState(false)

  // Cambiar de juego o de mazo arranca de cero.
  useEffect(() => {
    setSlots(emptySlots(variant, 2))
    setActive({ kind: "player", p: 0, i: 0 })
  }, [variant])

  const used = useMemo(
    () => [...slots.players.flat(), ...slots.board].filter((c): c is Card => c !== null),
    [slots],
  )
  const complete = slots.players.every((h) => h.every((c) => c !== null))
  const board = slots.board.filter((c): c is Card => c !== null)

  useEffect(() => {
    setResult(null)
    if (!complete) return
    const holes = slots.players as Card[][]
    const signal = { cancelled: false }
    setRunning(true)
    const t = setTimeout(() => {
      computeEquityAsync(holes, board, variant, { signal, onProgress: (r) => !signal.cancelled && setResult(r) }).then(
        (r) => {
          if (signal.cancelled) return
          setResult(r)
          setRunning(false)
        },
      )
    }, 150)
    return () => {
      signal.cancelled = true
      clearTimeout(t)
      setRunning(false)
    }
    // board se deriva de slots
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, variant, complete])

  /** Siguiente hueco vacío después de `from` (recorre jugadores y después la mesa). */
  const nextEmpty = (s: Slots, from: Slot | null): Slot | null => {
    const order: Slot[] = [
      ...s.players.flatMap((h, p) => h.map((_, i) => ({ kind: "player" as const, p, i }))),
      ...s.board.map((_, i) => ({ kind: "board" as const, i })),
    ]
    const start = from ? order.findIndex((o) => sameSlot(from, o)) : -1
    for (let k = 1; k <= order.length; k++) {
      const o = order[(start + k) % order.length]
      const val = o.kind === "board" ? s.board[o.i] : s.players[o.p][o.i]
      if (val === null) return o
    }
    return null
  }

  const setSlot = (s: Slots, slot: Slot, card: Card | null): Slots => {
    if (slot.kind === "board") {
      const b = s.board.slice()
      b[slot.i] = card
      return { ...s, board: b }
    }
    const players = s.players.map((h) => h.slice())
    players[slot.p][slot.i] = card
    return { ...s, players }
  }

  const pickCard = (c: Card) => {
    if (!active || used.includes(c)) return
    const next = setSlot(slots, active, c)
    setSlots(next)
    setActive(nextEmpty(next, active))
  }

  const tapSlot = (slot: Slot, value: Card | null) => {
    if (value !== null && sameSlot(active, slot)) {
      // Segundo toque sobre una carta ya puesta: la saca.
      setSlots(setSlot(slots, slot, null))
      return
    }
    setActive(slot)
  }

  const randomFill = () => {
    let s = slots
    const pool = shuffle(remainingDeck(variant.deck, used))
    s = { ...s, players: s.players.map((h) => h.map((c) => c ?? pool.pop()!)) }
    setSlots(s)
    setActive(nextEmpty(s, null))
  }

  const changePlayers = (delta: number) => {
    const n = slots.players.length + delta
    if (n < 2 || n > maxPlayers(variant)) return
    const players =
      delta > 0
        ? [...slots.players, new Array(GAMES[variant.game].holeCount).fill(null)]
        : slots.players.slice(0, n)
    const s = { ...slots, players }
    setSlots(s)
    setActive(nextEmpty(s, null))
  }

  const holeSize = variant.game === "holdem" ? "md" : "sm"
  const deck = makeDeck(variant.deck)
  const ranks = [...new Set(deck.map(rankOf))]

  return (
    <div className="space-y-3">
      <UICard>
        <CardContent className="p-3 space-y-3">
          <div className="flex items-center justify-between">
            <Label>Jugadores</Label>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => changePlayers(-1)}>
                <Minus className="w-4 h-4" />
              </Button>
              <span className="tabular-nums w-4 text-center text-sm">{slots.players.length}</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => changePlayers(1)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {slots.players.map((hole, p) => {
            const full = hole.every((c) => c !== null)
            const hand = full && board.length >= 3 ? bestHand(hole as Card[], board, variant.game, variant.deck) : null
            return (
              <div key={p} className="rounded-lg border p-2">
                <div className="flex items-center justify-between mb-1 text-sm">
                  <span className="font-medium">Jugador {p + 1}</span>
                  {hand && <span className="text-xs text-muted-foreground">{hand.name}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {hole.map((c, i) => {
                      const slot: Slot = { kind: "player", p, i }
                      return (
                        <button key={i} type="button" onClick={() => tapSlot(slot, c)}>
                          {c === null ? (
                            <EmptyCard size={holeSize} active={sameSlot(active, slot)} />
                          ) : (
                            <PlayingCard
                              card={c}
                              size={holeSize}
                              className={sameSlot(active, slot) ? "ring-2 ring-primary" : undefined}
                            />
                          )}
                        </button>
                      )
                    })}
                  </div>
                  {result && (
                    <div className="flex-1 min-w-0 text-right">
                      <div className="text-lg font-bold tabular-nums">{pct(result.equity[p])}</div>
                      <div className="text-[10px] text-muted-foreground tabular-nums">
                        gana {pct(result.win[p], 0)} · reparte {pct(result.tie[p], 0)}
                      </div>
                    </div>
                  )}
                </div>
                {result && (
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${result.equity[p] * 100}%` }} />
                  </div>
                )}
              </div>
            )
          })}

          <div>
            <Label>Mesa</Label>
            <div className="flex gap-1">
              {slots.board.map((c, i) => {
                const slot: Slot = { kind: "board", i }
                return (
                  <button key={i} type="button" onClick={() => tapSlot(slot, c)} className={i === 3 ? "ml-2" : i === 4 ? "ml-2" : ""}>
                    {c === null ? (
                      <EmptyCard active={sameSlot(active, slot)} />
                    ) : (
                      <PlayingCard card={c} className={sameSlot(active, slot) ? "ring-2 ring-primary" : undefined} />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground min-h-5">
            {!complete ? (
              <span>Completá las manos para calcular. Tocá un hueco y después una carta.</span>
            ) : running ? (
              <span className="flex items-center gap-1">
                <ChipSpinner className="w-3.5 h-3.5" /> Calculando…
              </span>
            ) : result ? (
              <span>
                {result.exact
                  ? `Cálculo exacto (${result.samples.toLocaleString("es-AR")} mesas)`
                  : // Margen del 95% en el peor caso (p = 0,5): 2·√(0,25/n) = 1/√n.
                    `Simulación de ${result.samples.toLocaleString("es-AR")} mesas (±${pct(1 / Math.sqrt(result.samples))})`}
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={randomFill}>
              <Shuffle className="w-4 h-4 mr-1" /> Manos al azar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const s = emptySlots(variant, slots.players.length)
                setSlots(s)
                setActive({ kind: "player", p: 0, i: 0 })
              }}
            >
              <Trash2 className="w-4 h-4 mr-1" /> Limpiar
            </Button>
          </div>
        </CardContent>
      </UICard>

      <UICard>
        <CardContent className="p-2 space-y-1">
          {[0, 1, 2, 3].map((suit) => (
            <div key={suit} className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${ranks.length}, minmax(0, 1fr))` }}>
              {ranks.map((r) => {
                const c = (r - 2) * 4 + suit
                const taken = used.includes(c)
                return (
                  <button
                    key={c}
                    type="button"
                    disabled={taken || !active}
                    onClick={() => pickCard(c)}
                    className={cn(
                      "h-10 rounded-[5px] flex flex-col items-center justify-center gap-[2px] leading-none transition-[filter]",
                      CARD_FACE,
                      SUIT_TEXT[suitOf(c)],
                      // Oscurecer en vez de transparentar, como las cartas que no se usan en Entrenar.
                      taken && "brightness-[0.35]",
                    )}
                    aria-label={`${RANK_LABELS[r]}${SUITS[suit]}`}
                  >
                    <span className={cn(CARD_RANK_FONT, "text-[14px]")}>{RANK_LABELS[r]}</span>
                    <span className="text-[12px] drop-shadow-[0_1px_0_rgb(0_0_0/0.15)]">{SUITS[suit]}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </CardContent>
      </UICard>
    </div>
  )
}
