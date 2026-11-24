"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import * as db from "@/lib/database"
import { getTodayLocalDate } from "@/lib/formatters"
import type { Player } from "@/lib/types"
import { levelFor, type DrillId, type WeakSpot } from "@/lib/poker/training"
import { difficultyForLevel, type Difficulty } from "@/lib/poker/difficulty"
import { TrainingContext } from "@/components/training/drill-shell"
import { TrainerCard, useTrainingProgress } from "@/components/training/progress-panel"
import { PracticeSession } from "@/components/training/practice-session"
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
import type { DeckType } from "@/lib/poker/cards"
import { GAMES, GAME_IDS, type GameId, type Variant } from "@/lib/poker/variants"
import type { TrainingProgress } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  BookOpen,
  Brain,
  Calculator,
  Coins,
  Dumbbell,
  GitCompareArrows,
  Layers,
  Scale,
  Swords,
  Target,
  type LucideIcon,
} from "lucide-react"

type Subtab = "ejercicios" | "calculadora" | "manos"
/** Cómo se pone plata antes de repartir: luz igual para todos (La Cajita) o ciegas (casino). */
type Structure = "luz" | "ciegas"
/** "Antes del flop" muestra el ejercicio de luz o el de ciegas según la estructura elegida. */
type DrillChoice = Exclude<DrillId, "luz" | "preflop"> | "antes"

const DRILLS: { id: DrillChoice; label: string; icon: LucideIcon; isNew?: boolean }[] = [
  { id: "usable", label: "¿Qué tenés?", icon: Layers },
  { id: "whoWins", label: "¿Quién gana?", icon: Swords },
  { id: "outs", label: "Outs", icon: Target },
  { id: "potOdds", label: "¿Call o fold?", icon: Scale },
  { id: "compare", label: "¿Cuál es mejor?", icon: GitCompareArrows },
  { id: "antes", label: "Antes del flop", icon: Coins },
  { id: "gto", label: "GTO river", icon: Brain, isNew: true },
]

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

/** Aciertos de un ejercicio (Antes del flop junta luz y ciegas). */
function drillTally(p: TrainingProgress | null, id: DrillChoice) {
  if (!p) return null
  const ids: DrillId[] = id === "antes" ? ["luz", "preflop"] : [id]
  return ids.reduce(
    (a, d) => ({ right: a.right + (p.byDrill[d]?.right ?? 0), total: a.total + (p.byDrill[d]?.total ?? 0) }),
    { right: 0, total: 0 },
  )
}

/**
 * Tarjetas para elegir el ejercicio, en una tira que se desliza de costado:
 * ícono, nombre y cómo te va (barra de aciertos).
 */
function DrillPicker({
  value,
  onChange,
  progress,
}: {
  value: DrillChoice
  onChange: (d: DrillChoice) => void
  progress: TrainingProgress | null
}) {
  return (
    <div
      className="-mx-1 flex snap-x scroll-px-1 gap-2 overflow-x-auto overscroll-x-contain px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {DRILLS.map((d) => {
        const t = drillTally(progress, d.id)
        const ratio = t?.total ? t.right / t.total : 0
        const active = value === d.id
        const Icon = d.icon
        return (
          <button
            key={d.id}
            type="button"
            onClick={() => onChange(d.id)}
            className={cn(
              "relative flex shrink-0 snap-start items-center gap-2 overflow-hidden rounded-2xl border-2 py-2 pl-2 pr-3 text-left transition-all active:scale-[0.97]",
              active ? "border-primary bg-primary/10" : "border-border bg-card",
            )}
          >
            {d.isNew && (
              <span className="absolute right-1 top-0.5 rounded-full bg-primary px-1 text-[8px] font-black uppercase leading-3 text-primary-foreground">
                Nuevo
              </span>
            )}
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className={cn("whitespace-nowrap text-[13px] font-semibold leading-tight", !active && "text-muted-foreground")}>
              {d.label}
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
  )
}

const PLAYER_KEY = "la-cajita:entrenar:jugador"

/** Jugadores que no aparecen en "¿Quién sos?" de Entrenar (por nombre, sin importar mayúsculas). */
const HIDDEN_IN_ENTRENAR = ["nano", "tito"]

export function EntrenarTab({ players: allPlayers }: { players: Player[] }) {
  const players = useMemo(
    () => allPlayers.filter((p) => !HIDDEN_IN_ENTRENAR.includes(p.name.trim().toLowerCase())),
    [allPlayers],
  )
  const [game, setGame] = useState<GameId>("holdem")
  const [deck, setDeck] = useState<DeckType>("long")
  const [subtab, setSubtab] = useState<Subtab>("ejercicios")
  const [drill, setDrill] = useState<DrillChoice>("usable")
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
    (drillId: DrillId, v: Variant, correct: boolean) => {
      if (!playerId) return
      db.recordTrainingAnswer({ playerId, drill: drillId, game: v.game, deck: v.deck, correct, localDate: getTodayLocalDate() })
        .then(() => setVersion((n) => n + 1))
        .catch(() => {})
    },
    [playerId],
  )
  const progress = useTrainingProgress(playerId, version)
  // Dificultad según tu nivel (aciertos acumulados). Sin nombre elegido: media.
  const difficulty: Difficulty = useMemo(() => {
    if (!playerId || !progress) return "media"
    const right = Object.values(progress.byDrill).reduce((a, t) => a + t.right, 0)
    return difficultyForLevel(levelFor(right).level)
  }, [playerId, progress])
  const ctx = useMemo(() => ({ onAnswer, difficulty }), [onAnswer, difficulty])

  const variant = useMemo<Variant>(() => ({ game, deck }), [game, deck])

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
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm pt-3 pb-2 -mx-1 px-1">
          <IconTabsList
            tabs={[
              { value: "ejercicios", label: "Ejercicios", icon: Dumbbell },
              { value: "calculadora", label: "Calc", icon: Calculator },
              { value: "manos", label: "Jugadas", icon: BookOpen },
            ]}
          />
        </div>

        <TabsContent value="ejercicios" className="pt-1 pb-8 space-y-3 mt-0">
          {practice ? (
            <PracticeSession spots={practice} onExit={() => setPractice(null)} />
          ) : (
            <>
              {!challengeActive && (
                <TrainerCard
                  players={players}
                  playerId={playerId}
                  onPlayerChange={changePlayer}
                  progress={progress}
                  onPractice={setPractice}
                />
              )}
              <DailyChallenge playerId={playerId} onActiveChange={setChallengeActive} />
              {!challengeActive && (
                <>
                  <div className="pt-1 space-y-3">
                    <DrillPicker value={drill} onChange={setDrill} progress={progress} />
                    {drill !== "gto" && picker}
                    {drill === "antes" && structurePicker}
                  </div>
                  {drill === "usable" && <UsableDrill variant={variant} />}
                  {drill === "whoWins" && <WhoWinsDrill variant={variant} />}
                  {drill === "outs" && <OutsDrill variant={variant} />}
                  {drill === "potOdds" && <PotOddsDrill variant={variant} />}
                  {drill === "compare" && <CompareDrill variant={variant} />}
                  {drill === "antes" && structure === "luz" && <LuzDrill variant={variant} />}
                  {drill === "antes" && structure === "ciegas" && <PreflopDrill variant={variant} />}
                  {drill === "gto" && <GtoDrill variant={variant} />}
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
