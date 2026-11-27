"use client"

import { useEffect, useState } from "react"

// Paleta de La Cajita Truco (ver .truco-* en app/globals.css). Mientras
// estás en /truco la clase va en <html>; al volver a Poker se saca.
// Por ahora se elige en Ajustes de Truco (selector de prueba) y se guarda en
// este celular.

export const TRUCO_PALETTES = [
  { id: "a", name: "Naipe", desc: "Bermellón, crema y oro" },
  { id: "b", name: "Oro y espada", desc: "Oro sobre azul" },
  { id: "c", name: "Boliche", desc: "Oro y granate" },
] as const

export type TrucoPalette = (typeof TRUCO_PALETTES)[number]["id"]

const KEY = "la-cajita:truco:paleta"

export function useTrucoPalette(): [TrucoPalette, (p: TrucoPalette) => void] {
  const [palette, setPalette] = useState<TrucoPalette>("a")

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY)
      if (saved && TRUCO_PALETTES.some((p) => p.id === saved)) setPalette(saved as TrucoPalette)
    } catch {}
  }, [])

  useEffect(() => {
    const cls = `truco-${palette}`
    document.documentElement.classList.add(cls)
    return () => document.documentElement.classList.remove(cls)
  }, [palette])

  const choose = (p: TrucoPalette) => {
    setPalette(p)
    try {
      localStorage.setItem(KEY, p)
    } catch {}
  }

  return [palette, choose]
}
