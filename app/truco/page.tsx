"use client"

// La Cajita Truco: app hermana de Poker (ver docs/plan-truco.md). Misma PWA y
// misma sesión (admin e invitado); se entra y se sale desde Configuración. Con
// el PIN de Truco (rol "truco") solo existe esta app: no se ofrece ir a Poker.

import { useEffect, useState } from "react"
import { Brain, GraduationCap, Settings, Swords } from "lucide-react"
import { FosforoIcon } from "@/components/truco/fosforo-icon"
import { Aprender } from "@/components/truco/aprender"
import { SuitGlyph } from "@/components/truco/suit-glyph"
import { LogoType } from "@/components/logo-type"
import { Anotador } from "@/components/truco/anotador"
import { Jugar } from "@/components/truco/jugar"
import { Practicar } from "@/components/truco/practicar"
import { useTrucoTheme } from "@/hooks/use-truco-theme"
import { setLastApp } from "@/lib/last-app"
import { TrucoSplash } from "@/components/splash-screen"
import { AjustesCard } from "@/components/ajustes-card"
import { PokerPromo } from "@/components/poker-promo"
import { DockNav, type DockTab } from "@/components/dock-nav"
import { OfflineIndicator } from "@/components/offline-indicator"
import { PWAInstall } from "@/components/pwa-install"
import { getSessionRole } from "@/lib/database"

type TrucoTab = "aprender" | "practicar" | "jugar" | "anotar" | "config"

// Íconos que dicen qué hace cada pestaña, como en Poker: Practicar con el
// mismo cerebro que Entrenar. Anotar va al centro con el fósforo propio, como
// Partidas con la pica en Poker.
const TABS: DockTab<TrucoTab>[] = [
  { id: "jugar", label: "Jugar contra la máquina", short: "Jugar", icon: Swords },
  { id: "practicar", label: "Practicar", short: "Practicar", icon: Brain },
  { id: "anotar", label: "Anotador", short: "Anotar", icon: FosforoIcon },
  { id: "aprender", label: "Aprender", short: "Aprender", icon: GraduationCap },
  { id: "config", label: "Configuración", short: "Ajustes", icon: Settings },
]

const TAB_KEY = "la-cajita:truco:tab"

export default function TrucoPage() {
  const [tab, setTab] = useState<TrucoTab>("anotar")
  useTrucoTheme()
  useEffect(() => setLastApp("truco"), [])
  // La sesión de Truco no puede entrar a Poker: sin la presentación para ir.
  const [trucoOnly, setTrucoOnly] = useState(true)
  useEffect(() => {
    getSessionRole()
      .then((role) => setTrucoOnly(role === "truco"))
      .catch(() => {})
  }, [])

  // Splash de Truco cada vez que se llega (también desde Poker, como al revés).
  // Arranca en "on" desde el primer HTML.
  const [splash, setSplash] = useState<"on" | "leaving" | "off">("on")
  useEffect(() => {
    const t1 = setTimeout(() => setSplash("leaving"), 1100)
    const t2 = setTimeout(() => setSplash("off"), 1450)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

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
    aprender: <Aprender onPractice={() => select("practicar")} />,
    practicar: <Practicar />,
    jugar: <Jugar active={tab === "jugar"} />,
    anotar: <Anotador active={tab === "anotar"} />,
    config: (
      <div className="space-y-4 pt-4 pb-8">
        {!trucoOnly && <PokerPromo />}
        <AjustesCard />
      </div>
    ),
  }

  return (
    <div className="relative h-[100dvh] flex flex-col">
      {/* Mismo encabezado que Poker: fondo sólido, ios-pwa-top-gap para la app instalada de iOS. */}
      <div className="ios-pwa-top-gap border-b bg-background text-foreground flex-shrink-0">
        {/* Los cuatro palos españoles alrededor del logo, en dos tintas como ♠♥♦♣ en Poker. */}
        <div className="container mx-auto flex items-center justify-around px-4 py-2 text-lg font-bold md:text-xl">
          <SuitGlyph suit="espada" className="size-3.5" />
          <SuitGlyph suit="copa" className="size-3.5 text-primary" />
          <LogoType className="text-[26px]" />
          <SuitGlyph suit="oro" className="size-3.5 text-primary" />
          <SuitGlyph suit="basto" className="size-3.5" />
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

      <DockNav tabs={TABS} active={tab} centerId="anotar" onSelect={select} />
      <PWAInstall />
      <OfflineIndicator />
      {splash !== "off" && <TrucoSplash leaving={splash === "leaving"} />}
    </div>
  )
}
