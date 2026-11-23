"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import * as db from "@/lib/database"
import { getTodayLocalDate } from "@/lib/formatters"
import type { Player } from "@/lib/types"
import type { DrillId } from "@/lib/poker/training"
import { TrainingContext } from "@/components/training/drill-shell"
import { ProgressPanel } from "@/components/training/progress-panel"
import { DailyChallenge } from "@/components/training/daily-challenge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import type { DeckType } from "@/lib/poker/cards"
import { GAMES, GAME_IDS, type GameId, type Variant } from "@/lib/poker/variants"
import { cn } from "@/lib/utils"

type Subtab = "ejercicios" | "calculadora" | "manos"
/** Cómo se pone plata antes de repartir: luz igual para todos (La Cajita) o ciegas (casino). */
type Structure = "luz" | "ciegas"
/** "Antes del flop" muestra el ejercicio de luz o el de ciegas según la estructura elegida. */
type DrillChoice = Exclude<DrillId, "luz" | "preflop"> | "antes"

const DRILLS: { id: DrillChoice; label: string }[] = [
  { id: "usable", label: "¿Qué tenés?" },
  { id: "whoWins", label: "¿Quién gana?" },
  { id: "outs", label: "Outs" },
  { id: "potOdds", label: "¿Call o fold?" },
  { id: "compare", label: "¿Cuál es mejor?" },
  { id: "antes", label: "Antes del flop" },
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
    <div className="flex rounded-md bg-muted p-0.5 text-sm">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "flex-1 rounded px-1.5 py-1 transition-colors whitespace-nowrap",
            value === o.id ? "bg-background shadow-sm font-medium" : "text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Botones grandes para elegir el ejercicio (44px de alto: cómodos de tocar). */
function DrillPicker({ value, onChange }: { value: DrillChoice; onChange: (d: DrillChoice) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {DRILLS.map((d) => (
        <button
          key={d.id}
          type="button"
          onClick={() => onChange(d.id)}
          className={cn(
            "min-h-11 rounded-lg border px-1 text-[13px] leading-tight transition-colors",
            value === d.id
              ? "border-primary bg-primary/20 font-semibold"
              : "border-transparent bg-muted text-muted-foreground active:bg-muted/60",
          )}
        >
          {d.label}
        </button>
      ))}
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
  const ctx = useMemo(() => ({ onAnswer }), [onAnswer])

  const variant = useMemo<Variant>(() => ({ game, deck }), [game, deck])

  const picker = (withStructure: boolean) => (
    <div className="space-y-2">
      <Segmented value={game} onChange={setGame} options={GAME_IDS.map((id) => ({ id, label: GAMES[id].name }))} />
      <div className={cn("grid gap-2", withStructure ? "grid-cols-2" : "grid-cols-1")}>
        <Segmented
          value={deck}
          onChange={setDeck}
          options={[
            { id: "long", label: "Long" },
            { id: "short", label: "Short" },
          ]}
        />
        {withStructure && (
          <Segmented
            value={structure}
            onChange={setStructure}
            options={[
              { id: "luz", label: "Luz" },
              { id: "ciegas", label: "Ciegas" },
            ]}
          />
        )}
      </div>
    </div>
  )

  return (
    <TrainingContext.Provider value={ctx}>
      <Tabs value={subtab} onValueChange={(v) => setSubtab(v as Subtab)} className="w-full">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pt-3 pb-2 -mx-1 px-1">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="ejercicios">Ejercicios</TabsTrigger>
            <TabsTrigger value="calculadora">Calculadora</TabsTrigger>
            <TabsTrigger value="manos">Jugadas</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="ejercicios" className="pt-1 pb-8 space-y-3 mt-0">
          {!challengeActive && (
            <ProgressPanel players={players} playerId={playerId} onPlayerChange={changePlayer} version={version} />
          )}
          <DailyChallenge playerId={playerId} onActiveChange={setChallengeActive} />
          {!challengeActive && (
            <>
              <div className="pt-2 space-y-2">
                {picker(true)}
                <DrillPicker value={drill} onChange={setDrill} />
              </div>
              {drill === "usable" && <UsableDrill variant={variant} />}
              {drill === "whoWins" && <WhoWinsDrill variant={variant} />}
              {drill === "outs" && <OutsDrill variant={variant} />}
              {drill === "potOdds" && <PotOddsDrill variant={variant} />}
              {drill === "compare" && <CompareDrill variant={variant} />}
              {drill === "antes" && structure === "luz" && <LuzDrill variant={variant} />}
              {drill === "antes" && structure === "ciegas" && <PreflopDrill variant={variant} />}
            </>
          )}
        </TabsContent>

        <TabsContent value="calculadora" className="pt-1 pb-8 space-y-3 mt-0">
          {picker(false)}
          <EquityCalculator variant={variant} />
        </TabsContent>

        <TabsContent value="manos" className="pt-1 pb-8 space-y-3 mt-0">
          {picker(true)}
          <HandRankings variant={variant} />
          <OmahaPrinciples variant={variant} />
          {structure === "ciegas" ? (
            <PreflopRanges variant={variant} />
          ) : (
            <div className="space-y-1 text-sm">
              <h3 className="font-semibold">Con qué manos hacer bet</h3>
              <p className="text-xs text-muted-foreground">
                Con luz no hay una tabla publicada de qué manos jugar, así que no mostramos una. Lo seguro: si nadie
                hizo bet, nunca hagas fold (podés hacer check gratis), y para hacer call a un bet hacé la cuenta con el
                pozo de luces (ejercicio «Antes del flop»). Elegí «Ciegas» para ver la tabla del juego de casino.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </TrainingContext.Provider>
  )
}
