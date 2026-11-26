"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as db from "@/lib/database"
import { getTodayLocalDate } from "@/lib/formatters"
import type { Player } from "@/lib/types"
import { isGameFree, levelFor, type DrillId, type TrainingSeat, type TrainingStreet, type WeakSpot } from "@/lib/poker/training"
import { difficultyForLevel, type Difficulty } from "@/lib/poker/difficulty"
import { TrainingContext } from "@/components/training/drill-shell"
import { TrainerCard, useTrainingProgress } from "@/components/training/progress-panel"
import { PracticeSession } from "@/components/training/practice-session"
import { PreflopVsDrill } from "@/components/training/preflop-vs-drill"
import { DailyChallenge } from "@/components/training/daily-challenge"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { IconTabsList } from "@/components/icon-tabs"
import { WhoWinsDrill } from "@/components/training/who-wins-drill"
import { UsableDrill } from "@/components/training/usable-drill"
import { PreflopDrill, PreflopRanges } from "@/components/training/preflop"
import { CompareDrill } from "@/components/training/compare-drill"
import { LuzDrill } from "@/components/training/luz-drill"
import { OmahaPrinciples } from "@/components/training/omaha-principles"
import { OutsDrill } from "@/components/training/outs-drill"
import { PotOddsDrill } from "@/components/training/pot-odds-drill"
import { EquityCalculator } from "@/components/training/equity-calculator"
import { HandRankings } from "@/components/training/hand-rankings"
import { GtoDrill } from "@/components/training/gto-drill"
import { BetOrCheckDrill, CallDownDrill, SemiBluffDrill, ShoveDrill } from "@/components/training/ev-drills"
import { BotTable } from "@/components/training/bot-table"
import type { DeckType } from "@/lib/poker/cards"
import { GAMES, GAME_IDS, type GameId, type Variant } from "@/lib/poker/variants"
import type { TrainingProgress } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useBackToClose } from "@/hooks/use-back-to-close"
import { Button } from "@/components/ui/button"
import {
  ArrowUp,
  Bot,
  BookOpen,
  ChevronLeft,
  ChevronsUp,
  DoorOpen,
  Filter,
  FlaskConical,
  Sigma,
  Calculator,
  Coins,
  Dumbbell,
  GitCompareArrows,
  Layers,
  Rocket,
  ShieldHalf,
  TrendingUp,
  Scale,
  Swords,
  Target,
  type LucideIcon,
} from "lucide-react"

type Subtab = "ejercicios" | "calculadora" | "manos"
/** Cómo se pone plata antes de repartir: luz igual para todos (La Cajita) o ciegas (casino). */
type Structure = "luz" | "ciegas"
/** Lo que se elige en el menú. Te suben / te resuben guardan sus respuestas como `preflopVs`. */
type DrillChoice = Exclude<DrillId, "preflopVs"> | "vsOpen" | "vs3bet"

interface DrillEntry {
  id: DrillChoice
  label: string
  icon: LucideIcon
  isNew?: boolean
  /** Todavía no está claro: etiqueta Beta y no entra al desafío (BETA_DRILLS). */
  isBeta?: boolean
}

/** El menú de ejercicios, por tema y de lo más simple a lo más avanzado. */
const GROUPS: { title: string; drills: DrillEntry[] }[] = [
  {
    title: "Leer la mano",
    drills: [
      { id: "usable", label: "¿Qué tenés?", icon: Layers },
      { id: "whoWins", label: "¿Quién gana?", icon: Swords },
      { id: "compare", label: "¿Cuál es mejor?", icon: GitCompareArrows },
    ],
  },
  {
    title: "Antes del flop",
    drills: [
      { id: "luz", label: "Con luz", icon: Coins },
      { id: "preflop", label: "Abrir (ciegas)", icon: DoorOpen },
      { id: "vsOpen", label: "Te suben", icon: ArrowUp },
      { id: "vs3bet", label: "Te resuben", icon: ChevronsUp },
    ],
  },
  {
    title: "Pagar o no",
    drills: [
      { id: "outs", label: "Outs", icon: Target },
      { id: "potOdds", label: "¿Call o fold?", icon: Scale },
      { id: "shove", label: "¿All-in o fold?", icon: Rocket, isBeta: true },
    ],
  },
  {
    title: "Cuentas GTO",
    drills: [
      { id: "gto", label: "GTO river", icon: Sigma },
      { id: "betOrCheck", label: "¿Apostar o pasar?", icon: TrendingUp, isBeta: true },
      { id: "semiBluff", label: "Bluffs con chances", icon: ShieldHalf, isBeta: true },
      { id: "callDown", label: "¿Qué le queda?", icon: Filter, isBeta: true },
    ],
  },
]
const ENTRIES = GROUPS.flatMap((g) => g.drills)
const toDrillId = (id: DrillChoice): DrillId => (id === "vsOpen" || id === "vs3bet" ? "preflopVs" : id)

const STORAGE_KEY = "la-cajita:entrenar"

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { id: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded-full bg-muted/70 p-1 text-sm">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "flex-1 rounded-full px-2 py-1.5 transition-all whitespace-nowrap",
            value === o.id ? "bg-background shadow font-semibold text-foreground" : "text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Aciertos de un ejercicio (Te suben y Te resuben se guardan juntos). */
function drillTally(p: TrainingProgress | null, id: DrillChoice) {
  const t = p?.byDrill[toDrillId(id)]
  return t ? { right: t.right, total: t.total } : null
}

/**
 * Menú de ejercicios: una grilla por tema. Cada tarjeta muestra cómo te va
 * (% de aciertos y la barrita) y si vale para todos los juegos.
 */
function DrillMenu({
  onOpen,
  onPlay,
  progress,
}: {
  onOpen: (d: DrillChoice) => void
  onPlay: () => void
  progress: TrainingProgress | null
}) {
  return (
    <div className="space-y-4 pt-1">
      <section className="space-y-2">
        <h3 className="px-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Jugar</h3>
        <button
          type="button"
          onClick={onPlay}
          className="flex w-full items-center gap-3 rounded-2xl border-2 border-primary/50 bg-gradient-to-b from-primary/15 to-transparent p-3 text-left transition-all active:scale-[0.98]"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
            <Bot className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 font-semibold">
              Mesa de práctica
            </div>
            <div className="text-xs text-muted-foreground">Manos completas contra bots, con luz o ciegas. No se anota.</div>
          </div>
        </button>
      </section>
      {GROUPS.map((g) => (
        <section key={g.title} className="space-y-2">
          <h3 className="px-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</h3>
          <div className="grid grid-cols-2 gap-2">
            {g.drills.map((d, i) => {
              const t = drillTally(progress, d.id)
              const ratio = t?.total ? t.right / t.total : 0
              const Icon = d.icon
              const free = isGameFree(toDrillId(d.id))
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onOpen(d.id)}
                  className={cn(
                    "relative flex min-h-[3.75rem] items-center gap-2.5 overflow-hidden rounded-2xl border-2 border-border bg-card py-2.5 pl-2.5 pr-2 text-left transition-all active:scale-[0.97] active:bg-muted",
                    // Si el grupo es impar, la última ocupa toda la fila (sin hueco).
                    g.drills.length % 2 === 1 && i === g.drills.length - 1 && "col-span-2",
                  )}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <Icon className="h-[18px] w-[18px]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold leading-tight">{d.label}</div>
                    <div className="mt-0.5 flex items-center justify-between gap-1 text-[11px] leading-tight text-muted-foreground">
                      <span className="flex min-w-0 items-center gap-1">
                        {d.isNew && (
                          <span className="shrink-0 rounded-full bg-primary px-1.5 text-[9px] font-black uppercase leading-4 text-primary-foreground">
                            Nuevo
                          </span>
                        )}
                        {d.isBeta && (
                          <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-muted px-1.5 text-[9px] font-black uppercase leading-4 text-muted-foreground">
                            <FlaskConical className="h-2.5 w-2.5" /> Beta
                          </span>
                        )}
                        <span className="truncate">
                          {free
                            ? "Todos los juegos"
                            : d.id === "vsOpen" || d.id === "vs3bet"
                              ? "Solo Hold'em Long"
                              : t?.total
                                ? `${t.total} respuestas`
                                : "Sin jugar"}
                        </span>
                      </span>
                      {t && t.total > 0 && (
                        <span
                          className={cn(
                            "font-semibold tabular-nums",
                            ratio >= 0.8 ? "text-emerald-500" : ratio >= 0.5 ? "text-amber-500" : "text-rose-500",
                          )}
                        >
                          {Math.round(ratio * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Cómo te va: una línea fina abajo de la tarjeta. */}
                  <div className="absolute inset-x-0 bottom-0 h-1 overflow-hidden bg-muted">
                    {t && t.total > 0 && (
                      <div
                        className={cn("h-full", ratio >= 0.8 ? "bg-emerald-500" : ratio >= 0.5 ? "bg-amber-500" : "bg-rose-500")}
                        style={{ width: `${ratio * 100}%` }}
                      />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

const PLAYER_KEY = "la-cajita:entrenar:jugador"

/** Jugadores que no aparecen en "¿Quién sos?" de Entrenar (por nombre, sin importar mayúsculas). */
const HIDDEN_IN_ENTRENAR = ["nano", "tito"]

export function EntrenarTab({
  players: allPlayers,
  onCreatePlayer,
}: {
  players: Player[]
  /** "Soy nuevo": crea el jugador (sin sumarlo a ningún torneo) y lo devuelve. */
  onCreatePlayer?: (name: string) => Promise<Player>
}) {
  const players = useMemo(
    () => allPlayers.filter((p) => !HIDDEN_IN_ENTRENAR.includes(p.name.trim().toLowerCase())),
    [allPlayers],
  )
  const [game, setGame] = useState<GameId>("holdem")
  const [deck, setDeck] = useState<DeckType>("long")
  const [subtab, setSubtab] = useState<Subtab>("ejercicios")
  /** Ejercicio abierto en pantalla propia (null: el menú). */
  const [drill, setDrill] = useState<DrillChoice | null>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const [structure, setStructure] = useState<Structure>("luz")
  const [playerId, setPlayerId] = useState<string | null>(null)
  /** Práctica de "lo que más fallo" en curso (reemplaza la pantalla de ejercicios). */
  const [practice, setPractice] = useState<WeakSpot[] | null>(null)
  const [version, setVersion] = useState(0)
  const [challengeActive, setChallengeActive] = useState(false)

  // Recordar el último juego elegido y quién entrena, en este dispositivo.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")
      if (saved?.game in GAMES) setGame(saved.game)
      if (saved?.deck === "long" || saved?.deck === "short") setDeck(saved.deck)
      if (saved?.structure === "luz" || saved?.structure === "ciegas") setStructure(saved.structure)
      setPlayerId(localStorage.getItem(PLAYER_KEY))
    } catch {
      // sin storage: arrancamos con Hold'em Long y sin jugador
    }
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ game, deck, structure }))
    } catch {
      // ignorar
    }
  }, [game, deck, structure])

  // Si el jugador guardado ya no existe (se borró), olvidarlo.
  useEffect(() => {
    if (playerId && players.length > 0 && !players.some((p) => p.id === playerId)) changePlayer(null)
  }, [players, playerId])

  const changePlayer = (id: string | null) => {
    setPlayerId(id)
    try {
      if (id) localStorage.setItem(PLAYER_KEY, id)
      else localStorage.removeItem(PLAYER_KEY)
    } catch {
      // ignorar
    }
  }

  // Cada respuesta se guarda (si hay jugador elegido). Si falla por falta de
  // señal, se pierde esa respuesta: no vale la pena una cola para esto.
  const onAnswer = useCallback(
    (drillId: DrillId, v: Variant, correct: boolean, where?: { street: string | null; seat: string | null }) => {
      if (!playerId) return
      db.recordTrainingAnswer({
        playerId,
        drill: drillId,
        game: v.game,
        deck: v.deck,
        correct,
        localDate: getTodayLocalDate(),
        street: (where?.street ?? null) as TrainingStreet | null,
        seat: (where?.seat ?? null) as TrainingSeat | null,
      })
        .then(() => setVersion((n) => n + 1))
        .catch(() => {})
    },
    [playerId],
  )
  const progress = useTrainingProgress(playerId, version)
  // Tu nivel (aciertos acumulados; null sin nombre elegido) y la dificultad que le toca (sin nivel: media).
  // El nivel también desbloquea a Nano en "Mesa de práctica".
  const playerLevel = useMemo(() => {
    if (!playerId || !progress) return null
    return levelFor(Object.values(progress.byDrill).reduce((a, t) => a + t.right, 0)).level
  }, [playerId, progress])
  const difficulty: Difficulty = playerLevel === null ? "media" : difficultyForLevel(playerLevel)
  const ctx = useMemo(() => ({ onAnswer, difficulty }), [onAnswer, difficulty])

  const variant = useMemo<Variant>(() => ({ game, deck }), [game, deck])

  // Cada ejercicio es una pantalla propia: el "atrás" del celular vuelve al menú.
  const closeDrill = useCallback(() => setDrill(null), [])
  useBackToClose(drill !== null, closeDrill, "entrenar-ejercicio")
  // "Lo que más fallás" también: atrás vuelve a Entrenar.
  const closePractice = useCallback(() => setPractice(null), [])
  useBackToClose(practice !== null, closePractice, "entrenar-practica")
  // "Mesa de práctica" también (la mesa queda guardada: al volver se retoma).
  const [bots, setBots] = useState(false)
  const closeBots = useCallback(() => setBots(false), [])
  useBackToClose(bots, closeBots, "entrenar-bots")
  // Al entrar o salir de un ejercicio, arrancar desde arriba.
  const firstScroll = useRef(true)
  useEffect(() => {
    if (firstScroll.current) {
      firstScroll.current = false
      return
    }
    topRef.current?.scrollIntoView({ block: "start" })
  }, [drill, bots])

  const entry = drill ? ENTRIES.find((e) => e.id === drill)! : null
  const inExercise = subtab === "ejercicios" && (!!drill || !!practice || challengeActive || bots)
  const heroName = players.find((p) => p.id === playerId)?.name ?? "Vos"
  const vsSituation = drill === "vsOpen" || drill === "vs3bet" ? drill : null

  const structurePicker = (
    <Segmented
      value={structure}
      onChange={setStructure}
      options={[
        { id: "luz", label: "Con luz" },
        { id: "ciegas", label: "Con ciegas" },
      ]}
    />
  )

  /** Juego y mazo en una sola fila; el mazo es una pastilla que alterna. */
  const picker = (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <Segmented value={game} onChange={setGame} options={GAME_IDS.map((id) => ({ id, label: GAMES[id].name }))} />
      </div>
      <button
        type="button"
        onClick={() => setDeck((d) => (d === "long" ? "short" : "long"))}
        aria-label={`Mazo ${deck === "long" ? "Long" : "Short"}: tocá para cambiar`}
        className={cn(
          "flex shrink-0 flex-col items-center rounded-2xl border bg-muted/70 px-2.5 py-1 leading-tight transition-colors active:scale-95",
        )}
      >
        <span className="text-sm font-bold">{deck === "long" ? "Long" : "Short"}</span>
        <span className="text-[10px] opacity-80">{deck === "long" ? "52 cartas" : "sin 2 a 5"}</span>
      </button>
    </div>
  )

  return (
    <TrainingContext.Provider value={ctx}>
      <Tabs value={subtab} onValueChange={(v) => setSubtab(v as Subtab)} className="w-full">
        {/* Dentro de un ejercicio (o el Desafío, o "Lo que más fallás") se sacan las pestañas: de lleno en el ejercicio; se vuelve con "Volver". */}
        {!inExercise && (
          <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm pt-3 pb-2 -mx-1 px-1">
            <IconTabsList
              tabs={[
                { value: "ejercicios", label: "Ejercicios", icon: Dumbbell },
                { value: "calculadora", label: "Calc", icon: Calculator },
                { value: "manos", label: "Jugadas", icon: BookOpen },
              ]}
            />
          </div>
        )}

        <TabsContent value="ejercicios" className={cn("pb-8 space-y-3 mt-0", inExercise ? "pt-3" : "pt-1")}>
          <div ref={topRef} className="scroll-mt-24" />
          {practice ? (
            <PracticeSession spots={practice} onExit={closePractice} />
          ) : bots ? (
            <div className="animate-fade-in space-y-3">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="-ml-2 gap-1 px-2" onClick={closeBots}>
                  <ChevronLeft className="h-4 w-4" />
                  Volver
                </Button>
                <div className="min-w-0 flex-1 truncate text-right text-xs text-muted-foreground">Mesa de práctica</div>
              </div>
              <BotTable heroName={heroName} difficulty={difficulty} level={playerLevel} />
            </div>
          ) : (
            <>
              {drill && entry ? (
                <div className="animate-fade-in space-y-3">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="-ml-2 gap-1 px-2" onClick={closeDrill}>
                      <ChevronLeft className="h-4 w-4" />
                      Volver
                    </Button>
                    <div className="min-w-0 flex-1 truncate text-right text-xs text-muted-foreground">
                      {GROUPS.find((g) => g.drills.includes(entry))!.title} · {entry.label}
                    </div>
                  </div>
                  {!isGameFree(toDrillId(drill)) && picker}
                  {drill === "usable" && <UsableDrill variant={variant} />}
                  {drill === "whoWins" && <WhoWinsDrill variant={variant} />}
                  {drill === "outs" && <OutsDrill variant={variant} />}
                  {drill === "potOdds" && <PotOddsDrill variant={variant} />}
                  {drill === "compare" && <CompareDrill variant={variant} />}
                  {drill === "luz" && <LuzDrill variant={variant} />}
                  {drill === "preflop" && <PreflopDrill variant={variant} />}
                  {vsSituation &&
                    (game === "holdem" && deck === "long" ? (
                      <PreflopVsDrill variant={variant} situation={vsSituation} />
                    ) : (
                      // Sin fuente para otros juegos y no inventamos (ver preflop-vs.ts).
                      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                        Pagar y resubir solo está para <b>Hold&apos;em Long</b>: es la única fuente publicada que encontramos
                        (PokerStrategy.com) y no queremos inventar rangos para {GAMES[game].name}
                        {deck === "short" ? " Short" : ""}. Cambiá el juego arriba para practicarlo.
                      </p>
                    ))}
                  {drill === "gto" && <GtoDrill variant={variant} />}
                  {drill === "betOrCheck" && <BetOrCheckDrill variant={variant} />}
                  {drill === "semiBluff" && <SemiBluffDrill variant={variant} />}
                  {drill === "shove" && <ShoveDrill variant={variant} />}
                  {drill === "callDown" && <CallDownDrill variant={variant} />}
                </div>
              ) : (
                <>
                  {!challengeActive && (
                    <TrainerCard
                      players={players}
                      playerId={playerId}
                      onPlayerChange={changePlayer}
                      onCreatePlayer={onCreatePlayer}
                      progress={progress}
                      onPractice={setPractice}
                    />
                  )}
                  <DailyChallenge playerId={playerId} onActiveChange={setChallengeActive} />
                  {!challengeActive && <DrillMenu onOpen={setDrill} onPlay={() => setBots(true)} progress={progress} />}
                </>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="calculadora" className="pt-1 pb-8 space-y-3 mt-0">
          {picker}
          <EquityCalculator variant={variant} />
        </TabsContent>

        <TabsContent value="manos" className="pt-1 pb-8 space-y-3 mt-0">
          {picker}
          {structurePicker}
          <HandRankings variant={variant} />
          <OmahaPrinciples variant={variant} />
          {structure === "ciegas" ? (
            <PreflopRanges variant={variant} />
          ) : (
            <div className="space-y-1 text-sm">
              <h3 className="font-semibold">Con qué manos apostar</h3>
              <p className="text-xs text-muted-foreground">
                Con luz no hay una tabla publicada de qué manos jugar, así que no mostramos una. Lo seguro: si nadie
                apostó, nunca hagas fold (podés hacer check gratis), y para hacer call a una apuesta hacé la cuenta con
                el pozo de luces (ejercicio «Antes del flop»). Elegí «Ciegas» para ver la tabla del juego de casino.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </TrainingContext.Provider>
  )
}
