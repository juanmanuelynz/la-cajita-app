"use client"

// La Cajita Truco: app hermana de Poker (ver docs/plan-truco.md). Misma PWA y
// misma sesión (admin e invitado); se entra y se sale desde Configuración.

import { useEffect, useState } from "react"
import { BookOpen, Flame, Settings, Swords, Target } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AjustesCard } from "@/components/ajustes-card"
import { DockNav, type DockTab } from "@/components/dock-nav"
import { OfflineIndicator } from "@/components/offline-indicator"

type TrucoTab = "aprender" | "practicar" | "jugar" | "anotar" | "config"

const TABS: DockTab<TrucoTab>[] = [
  { id: "aprender", label: "Aprender", short: "Aprender", icon: BookOpen },
  { id: "practicar", label: "Practicar", short: "Practicar", icon: Target },
  { id: "jugar", label: "Jugar contra la máquina", short: "Jugar", icon: Swords },
  { id: "anotar", label: "Anotador", short: "Anotar", icon: Flame },
  { id: "config", label: "Configuración", short: "Ajustes", icon: Settings },
]

const TAB_KEY = "la-cajita:truco:tab"

function Proximamente({ title, text }: { title: string; text: string }) {
  return (
    <div className="pt-4 pb-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{text}</p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function TrucoPage() {
  const [tab, setTab] = useState<TrucoTab>("aprender")

  // Vuelve a la última pestaña usada en este celular.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY) as TrucoTab | null
      if (saved && TABS.some((t) => t.id === saved)) setTab(saved)
    } catch {}
  }, [])

  const select = (id: TrucoTab) => {
    setTab(id)
    try {
      localStorage.setItem(TAB_KEY, id)
    } catch {}
  }

  const screens: Record<TrucoTab, React.ReactNode> = {
    aprender: <Proximamente title="Aprender" text="Las 8 lecciones: la baraja, la mano, qué carta gana, el envido, el truco, la partida, la flor y las señas." />,
    practicar: <Proximamente title="Practicar" text="¿Qué carta gana?, ¿Cuántos tantos tenés? y ¿Cuántos puntos son?, con tu progreso." />,
    jugar: <Proximamente title="Jugar" text="Mano a mano contra la máquina, a 15 o a 30, sin flor." />,
    anotar: <Proximamente title="Anotar" text="Anotador con fósforos para las partidas de verdad." />,
    config: (
      <div className="pt-4 pb-8">
        <AjustesCard app="truco" />
      </div>
    ),
  }

  return (
    <div className="relative h-[100dvh] flex flex-col">
      {/* Mismo encabezado que Poker: fondo sólido, ios-pwa-top-gap para la app instalada de iOS. */}
      <div className="ios-pwa-top-gap border-b bg-background text-foreground flex-shrink-0">
        <div className="container mx-auto flex items-center justify-center px-4 py-2 text-lg font-bold md:text-xl">
          <h1>La Cajita Truco</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 flex-1 min-h-0">
        {/* Todas montadas (se esconden) para no perder una partida o un ejercicio al cambiar de pestaña. */}
        {TABS.map((t) => (
          <div
            key={t.id}
            hidden={tab !== t.id}
            className="h-full overflow-y-auto no-scrollbar px-1 pb-[var(--dock-space)]"
          >
            {screens[t.id]}
          </div>
        ))}
      </div>

      <DockNav tabs={TABS} active={tab} centerId="jugar" onSelect={select} />
      <OfflineIndicator />
    </div>
  )
}
