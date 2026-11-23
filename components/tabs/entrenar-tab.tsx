"use client"

import { useEffect, useMemo, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WhoWinsDrill } from "@/components/training/who-wins-drill"
import { OutsDrill } from "@/components/training/outs-drill"
import { PotOddsDrill } from "@/components/training/pot-odds-drill"
import { EquityCalculator } from "@/components/training/equity-calculator"
import { HandRankings } from "@/components/training/hand-rankings"
import type { DeckType } from "@/lib/poker/cards"
import { GAMES, GAME_IDS, type GameId, type Variant } from "@/lib/poker/variants"
import { cn } from "@/lib/utils"

type Subtab = "ejercicios" | "calculadora" | "manos"
type DrillId = "whoWins" | "outs" | "potOdds"

const DRILLS: { id: DrillId; label: string }[] = [
  { id: "whoWins", label: "¿Quién gana?" },
  { id: "outs", label: "Outs" },
  { id: "potOdds", label: "¿Pagás?" },
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
            "flex-1 rounded px-2 py-1 transition-colors whitespace-nowrap",
            value === o.id ? "bg-background shadow-sm font-medium" : "text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function EntrenarTab() {
  const [game, setGame] = useState<GameId>("holdem")
  const [deck, setDeck] = useState<DeckType>("long")
  const [subtab, setSubtab] = useState<Subtab>("ejercicios")
  const [drill, setDrill] = useState<DrillId>("whoWins")

  // Recordar el último juego elegido en este dispositivo.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")
      if (saved?.game in GAMES) setGame(saved.game)
      if (saved?.deck === "long" || saved?.deck === "short") setDeck(saved.deck)
    } catch {
      // sin storage: arrancamos con Hold'em Long
    }
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ game, deck }))
    } catch {
      // ignorar
    }
  }, [game, deck])

  const variant = useMemo<Variant>(() => ({ game, deck }), [game, deck])

  return (
    <Tabs value={subtab} onValueChange={(v) => setSubtab(v as Subtab)} className="w-full">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pt-3 pb-2 -mx-1 px-1">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="ejercicios">Ejercicios</TabsTrigger>
          <TabsTrigger value="calculadora">Calculadora</TabsTrigger>
          <TabsTrigger value="manos">Jugadas</TabsTrigger>
        </TabsList>
      </div>
      <div className="pt-1 pb-1">
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
      </div>

      <TabsContent value="ejercicios" className="pt-2 pb-8 space-y-3 mt-0">
        <Segmented value={drill} onChange={setDrill} options={DRILLS} />
        {drill === "whoWins" && <WhoWinsDrill variant={variant} />}
        {drill === "outs" && <OutsDrill variant={variant} />}
        {drill === "potOdds" && <PotOddsDrill variant={variant} />}
      </TabsContent>

      <TabsContent value="calculadora" className="pt-2 pb-8 mt-0">
        <EquityCalculator variant={variant} />
      </TabsContent>

      <TabsContent value="manos" className="pt-2 pb-8 mt-0">
        <HandRankings variant={variant} />
      </TabsContent>
    </Tabs>
  )
}
