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
import { OutsDrill } from "@/components/training/outs-drill"
import { PotOddsDrill } from "@/components/training/pot-odds-drill"
import { EquityCalculator } from "@/components/training/equity-calculator"
import { HandRankings } from "@/components/training/hand-rankings"
import type { DeckType } from "@/lib/poker/cards"
import { GAMES, GAME_IDS, type GameId, type Variant } from "@/lib/poker/variants"
import { cn } from "@/lib/utils"

type Subtab = "ejercicios" | "calculadora" | "manos"

const DRILLS: { id: DrillId; label: string }[] = [
  { id: "usable", label: "¿Qué tenés?" },
  { id: "whoWins", label: "¿Quién gana?" },
  { id: "outs", label: "Outs" },
  { id: "potOdds", label: "¿Pagás?" },
  { id: "preflop", label: "¿Abrís?" },
]

const STORAGE_KEY = "la-cajita:entrenar"

function Segmented<T extends string>({
  value,
  options,
  onChange,
  small,
}: {
  value: T
  options: { id: T; label: string }[]
  onChange: (v: T) => void
  small?: boolean
}) {
  return (
    <div className={cn("flex rounded-md bg-muted p-0.5", small ? "text-xs" : "text-sm")}>
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

const PLAYER_KEY = "la-cajita:entrenar:jugador"

export function EntrenarTab({ players }: { players: Player[] }) {
  const [game, setGame] = useState<GameId>("holdem")
  const [deck, setDeck] = useState<DeckType>("long")
  const [subtab, setSubtab] = useState<Subtab>("ejercicios")
  const [drill, setDrill] = useState<DrillId>("usable")
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [challengeActive, setChallengeActive] = useState(false)

  // Recordar el último juego elegido y quién entrena, en este dispositivo.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")
      if (saved?.game in GAMES) setGame(saved.game)
      if (saved?.deck === "long" || saved?.deck === "short") setDeck(saved.deck)
      setPlayerId(localStorage.getItem(PLAYER_KEY))
    } catch {
      // sin storage: arrancamos con Hold'em Long y sin jugador
    }
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ game, deck }))
    } catch {
      // ignorar
    }
  }, [game, deck])

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

  const picker = (
    <div className="grid grid-cols-[1fr_auto] gap-2">
      <Segmented value={game} onChange={setGame} options={GAME_IDS.map((id) => ({ id, label: GAMES[id].name }))} />
      <Segmented
        value={deck}
        onChange={setDeck}
        options={[
          { id: "long", label: "Long" },
          { id: "short", label: "Short" },
        ]}
      />
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
                {picker}
                <Segmented value={drill} onChange={setDrill} options={DRILLS} small />
              </div>
              {drill === "usable" && <UsableDrill variant={variant} />}
              {drill === "whoWins" && <WhoWinsDrill variant={variant} />}
              {drill === "outs" && <OutsDrill variant={variant} />}
              {drill === "potOdds" && <PotOddsDrill variant={variant} />}
              {drill === "preflop" && <PreflopDrill variant={variant} />}
            </>
          )}
        </TabsContent>

        <TabsContent value="calculadora" className="pt-1 pb-8 space-y-3 mt-0">
          {picker}
          <EquityCalculator variant={variant} />
        </TabsContent>

        <TabsContent value="manos" className="pt-1 pb-8 space-y-3 mt-0">
          {picker}
          <HandRankings variant={variant} />
          <PreflopRanges variant={variant} />
        </TabsContent>
      </Tabs>
    </TrainingContext.Provider>
  )
}
