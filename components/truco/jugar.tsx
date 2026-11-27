"use client"

// Jugar (Truco): mano a mano contra la máquina, a 15 o a 30, sin flor. Port de
// la mesa del artefacto "Truco argentino" con el look de La Cajita. La partida,
// el récord y las estadísticas quedan en este celular (localStorage); nada va
// a la base. Motor en lib/truco/engine.ts, máquina en lib/truco/ai.ts.

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronDown, ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useBackToClose } from "@/hooks/use-back-to-close"
import { BOT_LEVEL_LABEL, BOT_LEVELS, decide, type BotLevel } from "@/lib/truco/ai"
import {
  act,
  actor,
  cardName,
  dealHand,
  ENVIDO_LABEL,
  envidoPoints,
  legal,
  newGame,
  TRUCO_LABEL,
  trucoValue,
  type GameState,
  type LogEntry,
  type Player,
  type TrucoAction,
} from "@/lib/truco/engine"
import { EMPTY_STATS, parseStats, ratio, updateStats, type PlayStats } from "@/lib/truco/play-stats"
import { halves } from "@/lib/truco/scorer"
import { playSound, preloadSounds } from "@/lib/sounds"
import { cn } from "@/lib/utils"
import { Fosforos } from "./fosforos"
import { SpanishCard, SpanishCardBack } from "./spanish-card"

const GAME_KEY = "la-cajita:truco:partida"
const TARGET_KEY = "la-cajita:truco:objetivo"
const STATS_KEY = "la-cajita:truco:estadisticas"
/** Nivel elegido para la próxima partida, y el de la partida guardada. */
const LEVEL_KEY = "la-cajita:truco:nivel"
const GAME_LEVEL_KEY = "la-cajita:truco:nivel-partida"

const LEVEL_HINT: Record<BotLevel, string> = {
  facil: "No miente y quiere casi todo.",
  media: "Canta, quiere y a veces miente.",
  dificil: "Piensa cada carta y miente más.",
}
const parseLevel = (raw: string | null): BotLevel =>
  BOT_LEVELS.includes(raw as BotLevel) ? (raw as BotLevel) : "media"
/** Lo que tarda la máquina en jugar o contestar. */
const AI_DELAY_MS = 900

const NAMES = ["Vos", "La máquina"] as const

function load<T>(key: string, parse: (raw: string | null) => T): T {
  try {
    return parse(localStorage.getItem(key))
  } catch {
    return parse(null)
  }
}
function save(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

/** Partida guardada, si sigue siendo válida (la de una versión vieja se descarta). */
function parseGame(raw: string | null): GameState | null {
  try {
    const g = JSON.parse(raw ?? "null")
    if (!g || !Array.isArray(g.score) || !g.hand || !Array.isArray(g.hand.tricks) || !Array.isArray(g.log)) return null
    return g as GameState
  } catch {
    return null
  }
}

/** El último canto de `p` en esta mano, si es de lo último que pasó (para el globito). */
function bubbleFor(g: GameState, p: Player): string | null {
  const calls = g.log.filter((x) => x.hand === g.hands && x.kind === "call" && x.who === p)
  const x = calls[calls.length - 1]
  if (!x) return null
  return g.log.slice(-4).includes(x) ? x.text : null
}

function statusText(g: GameState): string {
  const h = g.hand
  if (g.over || h.over) return ""
  const a = actor(g)
  const pd = h.pending
  if (a === 1) return pd ? "La máquina está pensando…" : "Juega la máquina…"
  if (pd) {
    const what = pd.kind === "truco" ? TRUCO_LABEL[pd.level] : ENVIDO_LABEL[h.envido.calls[h.envido.calls.length - 1]]
    return `Te cantaron ${what.toLowerCase()}. ¿Querés?`
  }
  return "Te toca: tirá una carta o cantá."
}

function Bubble({ text, side }: { text: string | null; side: "top" | "bottom" }) {
  if (!text) return null
  return (
    <div
      key={text}
      className={cn(
        "animate-bubble-pop absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-2xl bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground shadow-lg",
        side === "top" ? "top-full mt-1" : "bottom-full mb-1",
      )}
    >
      {text}
    </div>
  )
}

function ScoreBoard({ g }: { g: GameState }) {
  const col = (p: Player) => {
    const { malas, buenas } = halves(g.score[p], g.target)
    return (
      <div className={cn("flex min-w-0 flex-1 flex-col gap-1", p === 1 && "items-end text-right")}>
        <div className="text-sm">
          {NAMES[p]} <b className="ml-1 text-lg tabular-nums">{g.score[p]}</b>
        </div>
        <Fosforos n={malas} groupClassName="size-6" className={cn("gap-0.5", p === 1 && "justify-end")} />
        {g.target === 30 && buenas > 0 && (
          <Fosforos n={buenas} groupClassName="size-6" className={cn("gap-0.5 border-t border-dashed pt-1", p === 1 && "justify-end")} />
        )}
      </div>
    )
  }
  return (
    <div className="flex items-start gap-3 rounded-2xl border bg-card px-3 py-2" aria-label={`Vos ${g.score[0]}, la máquina ${g.score[1]}`}>
      {col(0)}
      <div className="pt-1 text-center text-[11px] leading-tight text-muted-foreground">
        a {g.target}
        {g.target === 30 && (
          <div>{Math.max(...g.score) >= 15 ? "buenas" : "malas"}</div>
        )}
      </div>
      {col(1)}
    </div>
  )
}

function LogList({ entries }: { entries: LogEntry[] }) {
  return (
    <ol className="max-h-60 space-y-1 overflow-y-auto text-sm">
      {entries
        .slice()
        .reverse()
        .map((x, i) => (
          <li
            key={entries.length - i}
            className={cn(
              x.kind === "explain" && "italic text-muted-foreground",
              x.kind === "points" && "font-semibold text-primary",
              x.kind === "end" && "text-base font-bold text-primary",
              x.kind === "info" && "text-muted-foreground/80",
            )}
          >
            {x.who !== null && <b>{NAMES[x.who]}: </b>}
            {x.text}
          </li>
        ))}
    </ol>
  )
}

function Table({
  g,
  onAction,
  onNextHand,
  onNewGame,
  onQuit,
}: {
  g: GameState
  onAction: (a: TrucoAction) => void
  onNextHand: () => void
  onNewGame: () => void
  onQuit: () => void
}) {
  const h = g.hand
  const l = legal(g, 0)
  const reveal = h.over || g.over
  const handLog = g.log.filter((x) => x.hand === g.hands)
  const [logOpen, setLogOpen] = useState(true)
  // Al terminar la mano, el cartel con "Siguiente mano" queda a la vista (si no, lo tapa la barra de abajo).
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (reveal) endRef.current?.scrollIntoView({ block: "center", behavior: "smooth" })
  }, [reveal])
  const value = h.truco.level ? `${TRUCO_LABEL[h.truco.level]} querido · vale ${trucoValue(h.truco.level)}` : "Vale 1"
  const tag = (p: Player) => (
    <span className="ml-1.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {g.mano === p ? "mano" : "pie"}
    </span>
  )

  return (
    <div className="space-y-3">
      <ScoreBoard g={g} />

      {/* La máquina (arriba) */}
      <div className="relative flex flex-col items-center gap-1.5">
        <div className="text-sm font-semibold">
          La máquina {tag(1)}
        </div>
        <div className="flex gap-1.5">
          {reveal
            ? h.cards[1].map((c, i) => <SpanishCard key={i} card={c} size="sm" />)
            : h.cards[1].map((_, i) => (
                <SpanishCardBack key={`${g.hands}-${i}`} size="sm" className="card-deal" />
              ))}
        </div>
        <Bubble text={bubbleFor(g, 1)} side="top" />
      </div>

      {/* El paño: las tres bazas */}
      <div className="truco-felt rounded-3xl px-3 py-2">
        <div className="flex flex-wrap justify-between gap-x-3 px-1 pb-1.5 text-xs text-white/80">
          <span>{value}</span>
          {h.envido.points && (
            <span>
              Envido: vos {h.envido.points[0]}, máquina {h.envido.points[1]}
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => {
            const t = h.tricks[i]
            const w = t?.winner
            return (
              <div key={i} className={cn("flex flex-col items-center gap-1.5", !t && "opacity-40")}>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-white/70">{["1ª", "2ª", "3ª"][i]}</span>
                {t?.cards[1] ? (
                  <SpanishCard key={`${g.hands}-${i}-1`} card={t.cards[1]} size="sm" highlight={w === 1} className="card-deal" />
                ) : (
                  <div className="h-[52px] w-9 rounded-[7px] border border-dashed border-white/25" />
                )}
                {t?.cards[0] ? (
                  <SpanishCard key={`${g.hands}-${i}-0`} card={t.cards[0]} size="sm" highlight={w === 0} className="card-deal" />
                ) : (
                  <div className="h-[52px] w-9 rounded-[7px] border border-dashed border-white/25" />
                )}
                <span className="min-h-[1em] text-[10px] font-bold uppercase tracking-wide text-primary">
                  {w === null || w === undefined ? "" : w === -1 ? "parda" : w === 0 ? "vos" : "máquina"}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Vos (abajo) */}
      <div className="relative flex flex-col items-center gap-1.5">
        <Bubble text={bubbleFor(g, 0)} side="bottom" />
        <div className="flex min-h-24 items-end justify-center gap-2">
          {h.cards[0].map((c, i) => (
            <button
              key={`${g.hands}-${c.num}-${c.suit}`}
              disabled={!l.play}
              onClick={() => onAction({ type: "play", index: i })}
              aria-label={`Jugar ${cardName(c)}`}
              className="rounded-[10px] transition-transform enabled:active:-translate-y-2 enabled:hover:-translate-y-2 disabled:cursor-default"
            >
              <SpanishCard card={c} size="lg" className="card-deal" />
            </button>
          ))}
        </div>
        <div className="text-sm font-semibold">
          Vos {tag(0)}
        </div>
      </div>

      <p className="min-h-[1.5em] text-center text-sm font-semibold" aria-live="polite">
        {statusText(g)}
      </p>

      {!reveal && (
        <div className="flex min-h-11 flex-wrap justify-center gap-2">
          {l.quiero && <Button onClick={() => onAction({ type: "quiero" })}>Quiero</Button>}
          {l.noQuiero && (
            <Button variant="secondary" onClick={() => onAction({ type: "noQuiero" })}>
              No quiero
            </Button>
          )}
          {l.envido.map((k) => (
            <Button
              key={k}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={() => onAction({ type: "envido", call: k })}
            >
              {ENVIDO_LABEL[k]}
            </Button>
          ))}
          {l.truco && (
            <Button
              variant={h.pending ? "outline" : "default"}
              className={cn(h.pending && "border-primary text-primary")}
              onClick={() => onAction({ type: "truco" })}
            >
              {h.pending ? `Quiero ${TRUCO_LABEL[l.truco].toLowerCase()}` : TRUCO_LABEL[l.truco]}
            </Button>
          )}
          {l.mazo && !h.pending && (
            <Button variant="ghost" onClick={() => onAction({ type: "mazo" })}>
              Irse al mazo
            </Button>
          )}
        </div>
      )}

      {reveal && (
        <Card
          ref={endRef}
          className={cn("animate-fade-in", g.over && (g.winner === 0 ? "border-primary" : "border-destructive/60"))}>
          <CardContent className="flex flex-col items-center gap-2 pt-5 text-center">
            {g.over ? (
              <>
                <p className="text-xl font-bold">{g.winner === 0 ? "¡Ganaste la partida!" : "Ganó la máquina"}</p>
                <p className="text-sm text-muted-foreground">
                  {g.score[0]} a {g.score[1]}
                </p>
              </>
            ) : (
              <p className="text-lg font-bold">
                {h.winner === 0 ? `Ganaste la mano: +${h.points}` : `La máquina gana la mano: +${h.points}`}
              </p>
            )}
            {/* Sus cartas ya están a la vista en la mesa; los tantos, solo si no se jugó el envido. */}
            {!h.envido.points && (
              <p className="text-xs text-muted-foreground">La máquina tenía {envidoPoints(h.dealt[1])} de envido.</p>
            )}
            {g.over ? (
              <Button size="lg" className="mt-1" onClick={onNewGame}>
                Otra partida
              </Button>
            ) : (
              <Button size="lg" className="mt-1" onClick={onNextHand}>
                Siguiente mano
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="rounded-2xl border bg-card px-3 py-2">
        <button className="flex w-full items-center justify-between py-1 text-sm font-semibold" onClick={() => setLogOpen((o) => !o)}>
          Qué pasó en esta mano
          <ChevronDown className={cn("size-4 transition-transform", logOpen && "rotate-180")} />
        </button>
        {logOpen && <LogList entries={handLog} />}
      </div>

      {!g.over && (
        <div className="flex justify-center">
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onQuit}>
            Abandonar partida
          </Button>
        </div>
      )}
    </div>
  )
}

function StatsCard({ st }: { st: PlayStats }) {
  if (!st.games && !st.hands) return null
  const items = [
    { label: "Partidas ganadas", value: `${st.wins} de ${st.games}`, sub: ratio(st.wins, st.games) },
    { label: "Manos ganadas", value: `${st.handsWon} de ${st.hands}`, sub: ratio(st.handsWon, st.hands) },
    { label: "Envidos ganados", value: `${st.envidosWon} de ${st.envidos}`, sub: ratio(st.envidosWon, st.envidos) },
    { label: "Trucos ganados", value: `${st.trucosWon} de ${st.trucos}`, sub: ratio(st.trucosWon, st.trucos) },
  ]
  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <p className="font-semibold">Tus números contra la máquina</p>
        <div className="grid grid-cols-2 gap-2">
          {items.map((x) => (
            <div key={x.label} className="rounded-xl bg-muted px-3 py-2">
              <div className="text-xs text-muted-foreground">{x.label}</div>
              <div className="font-semibold tabular-nums">
                {x.value} <span className="text-sm font-normal text-muted-foreground">· {x.sub}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Puntos: hiciste {st.pointsFor}, la máquina {st.pointsAgainst}. Envidos y trucos cuentan los que se quisieron.
        </p>
      </CardContent>
    </Card>
  )
}

export function Jugar({ active }: { active: boolean }) {
  const [game, setGame] = useState<GameState | null>(null)
  const [atTable, setAtTable] = useState(false)
  const [target, setTargetState] = useState<15 | 30>(30)
  const [stats, setStats] = useState<PlayStats>({ ...EMPTY_STATS })
  const [level, setLevelState] = useState<BotLevel>("media")
  const [gameLevel, setGameLevel] = useState<BotLevel>("media")
  const [confirmQuit, setConfirmQuit] = useState(false)
  const loaded = useRef(false)
  const topRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setGame(load(GAME_KEY, parseGame))
    setTargetState(load(TARGET_KEY, (r) => (r === "15" ? 15 : 30)))
    setStats(load(STATS_KEY, parseStats))
    setLevelState(load(LEVEL_KEY, parseLevel))
    setGameLevel(load(GAME_LEVEL_KEY, parseLevel))
    loaded.current = true
    preloadSounds(["cardShuffle", "cardDeal", "latchClick", "fosforoA", "fosforoB", "jingleMatch"])
  }, [])

  useEffect(() => {
    if (loaded.current) save(GAME_KEY, game)
  }, [game])
  useEffect(() => {
    if (loaded.current) save(STATS_KEY, stats)
  }, [stats])

  /** Pasa al estado `next`: estadísticas y sonidos según lo que cambió. */
  const advance = useCallback((prev: GameState, next: GameState) => {
    setStats((st) => updateStats(st, prev, next))
    setGame(next)
    const newLog = next.log.slice(prev.log.length)
    if (newLog.some((x) => x.kind === "play")) playSound("cardDeal")
    else if (newLog.some((x) => x.kind === "call")) playSound("latchClick")
    // Puntos: los fósforos (como en el anotador), uno por cada lado que sumó.
    if (next.score[0] > prev.score[0]) playSound("fosforoA", { delay: 250 })
    if (next.score[1] > prev.score[1]) playSound("fosforoB", { delay: 400 })
    if (next.over && !prev.over && next.winner === 0) playSound("jingleMatch", { delay: 600 })
  }, [])

  // La máquina juega sola cuando le toca (y la pestaña está a la vista).
  useEffect(() => {
    if (!game || !atTable || !active || actor(game) !== 1) return
    const id = setTimeout(() => {
      const d = decide(game, 1, Math.random, gameLevel)
      advance(game, act(game, 1, d))
    }, AI_DELAY_MS)
    return () => clearTimeout(id)
  }, [game, atTable, active, advance, gameLevel])

  const human = (a: TrucoAction) => {
    if (!game || actor(game) !== 0) return
    try {
      advance(game, act(game, 0, a))
    } catch {
      playSound("error")
    }
  }

  const dealSounds = () => {
    playSound("cardShuffle", { volume: 0.6 })
    for (let i = 0; i < 6; i++) playSound("cardDeal", { delay: 500 + i * 110 })
  }

  const start = () => {
    const g = newGame({ target, mano: Math.random() < 0.5 ? 0 : 1 })
    setGame(g)
    setGameLevel(level)
    try {
      localStorage.setItem(GAME_LEVEL_KEY, level)
    } catch {}
    setAtTable(true)
    dealSounds()
  }
  const nextHand = () => {
    if (!game) return
    advance(game, dealHand(game))
    for (let i = 0; i < 6; i++) playSound("cardDeal", { delay: i * 110 })
    topRef.current?.scrollIntoView({ block: "start" })
  }
  const newGameFromEnd = () => {
    setGame(null)
    setAtTable(false)
  }
  const quit = () => {
    setGame(null)
    setAtTable(false)
    setConfirmQuit(false)
  }
  const chooseLevel = (lv: BotLevel) => {
    setLevelState(lv)
    try {
      localStorage.setItem(LEVEL_KEY, lv)
    } catch {}
  }
  const chooseTarget = (t: 15 | 30) => {
    setTargetState(t)
    try {
      localStorage.setItem(TARGET_KEY, String(t))
    } catch {}
  }

  // "Atrás" del celular: sale de la mesa al menú (la partida queda guardada).
  const leaveTable = useCallback(() => setAtTable(false), [])
  useBackToClose(atTable && game !== null, leaveTable, "truco-mesa")

  if (atTable && game) {
    return (
      <div className="animate-fade-in space-y-3 pt-3 pb-8">
        <div ref={topRef} className="scroll-mt-24" />
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="-ml-2 gap-1 px-2" onClick={leaveTable}>
            <ChevronLeft className="h-4 w-4" />
            Volver
          </Button>
          <div className="min-w-0 flex-1 truncate text-right text-xs text-muted-foreground">
            {BOT_LEVEL_LABEL[gameLevel]} · mano {game.hands} · a {game.target}
          </div>
        </div>
        <Table g={game} onAction={human} onNextHand={nextHand} onNewGame={newGameFromEnd} onQuit={() => setConfirmQuit(true)} />
        <AlertDialog open={confirmQuit} onOpenChange={setConfirmQuit}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Abandonar la partida?</AlertDialogTitle>
              <AlertDialogDescription>
                Se pierde esta partida (va {game.score[0]} a {game.score[1]}). No cuenta como perdida.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Seguir jugando</AlertDialogCancel>
              <AlertDialogAction onClick={quit} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Abandonar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  const ongoing = game && !game.over ? game : null
  return (
    <div className="space-y-3 pt-4 pb-8">
      <Card>
        <CardContent className="space-y-4 pt-5">
          <div>
            <h2 className="text-xl font-bold">Mano a mano contra la máquina</h2>
            <p className="text-sm text-muted-foreground">
              Sin flor. Elegí el nivel de la máquina. Abajo de la mesa vas a ver qué pasó en cada jugada y por qué.
            </p>
          </div>
          {ongoing ? (
            <div className="space-y-2">
              <Button size="lg" className="w-full" onClick={() => setAtTable(true)}>
                Seguir la partida ({ongoing.score[0]} a {ongoing.score[1]}, {BOT_LEVEL_LABEL[gameLevel].toLowerCase()})
              </Button>
              <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setConfirmQuit(true)}>
                Abandonarla y empezar otra
              </Button>
            </div>
          ) : (
            <>
              <div role="radiogroup" aria-label="A cuántos puntos" className="flex w-fit rounded-full bg-muted p-1">
                {([15, 30] as const).map((t) => (
                  <button
                    key={t}
                    role="radio"
                    aria-checked={target === t}
                    onClick={() => chooseTarget(t)}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                      target === t ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                    )}
                  >
                    A {t}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                <div role="radiogroup" aria-label="Nivel de la máquina" className="grid grid-cols-3 rounded-full bg-muted p-1">
                  {BOT_LEVELS.map((lv) => (
                    <button
                      key={lv}
                      role="radio"
                      aria-checked={level === lv}
                      onClick={() => chooseLevel(lv)}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-sm font-semibold transition-colors",
                        level === lv ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                      )}
                    >
                      {BOT_LEVEL_LABEL[lv]}
                    </button>
                  ))}
                </div>
                <p className="px-1 text-xs text-muted-foreground">{LEVEL_HINT[level]}</p>
              </div>
              <Button size="lg" className="w-full" onClick={start}>
                Repartir
              </Button>
            </>
          )}
        </CardContent>
      </Card>
      <StatsCard st={stats} />
      <AlertDialog open={confirmQuit} onOpenChange={setConfirmQuit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Abandonar la partida?</AlertDialogTitle>
            <AlertDialogDescription>
              Se pierde la partida que tenías empezada. No cuenta como perdida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={quit} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Abandonar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
