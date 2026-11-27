"use client"

import { useEffect } from "react"

/**
 * Pone la paleta de Truco (clase .truco en <html>, ver app/globals.css)
 * mientras la pantalla está montada; al volver a Poker se saca.
 */
export function useTrucoTheme() {
  useEffect(() => {
    document.documentElement.classList.add("truco")
    return () => document.documentElement.classList.remove("truco")
  }, [])
}
