"use client"

import { useEffect, useState } from "react"
import { CHIP_COLORS, PokerChip } from "@/components/poker-chip"
import { playSequence } from "@/lib/sounds"


interface Piece {
  id: number
  left: number
  size: number
  delay: number
  duration: number
  drift: number
  spinX: number
  spinZ: number
  color: (typeof CHIP_COLORS)[number]
}

function makePieces(count: number): Piece[] {
  return Array.from({ length: count }, (_, id) => ({
    id,
    left: Math.random() * 100,
    size: 22 + Math.random() * 26,
    delay: Math.random() * 900,
    duration: 1800 + Math.random() * 1400,
    drift: (Math.random() - 0.5) * 160,
    spinX: 360 + Math.random() * 900,
    spinZ: (Math.random() - 0.5) * 720,
    color: CHIP_COLORS[Math.floor(Math.random() * CHIP_COLORS.length)],
  }))
}

/**
 * Lluvia de fichas a pantalla completa. Cada vez que cambia `trigger`
 * (y no es 0) se dispara una tanda nueva; se desmonta sola al terminar.
 */
export function ChipRain({ trigger, count = 36 }: { trigger: number; count?: number }) {
  const [pieces, setPieces] = useState<Piece[]>([])

  useEffect(() => {
    if (!trigger) return
    const next = makePieces(count)
    setPieces(next)
    const longest = Math.max(...next.map((p) => p.delay + p.duration))
    const t = setTimeout(() => setPieces([]), longest + 100)
    // Unos pocos montones de fichas repartidos mientras caen, no uno por ficha.
    const clinks = Math.min(5, Math.ceil(count / 12))
    const stopSound = playSequence(
      Array.from({ length: clinks }, (_, i) => ({
        name: "chipsRain" as const,
        at: (i * 1.2) / clinks + Math.random() * 0.15,
        volume: 0.35 + Math.random() * 0.25,
      })),
    )
    return () => {
      clearTimeout(t)
      stopSound()
    }
  }, [trigger, count])

  if (pieces.length === 0) return null

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[120] overflow-hidden [perspective:600px]">
      {pieces.map((p) => (
        <div
          key={`${trigger}-${p.id}`}
          className="chip-rain-piece"
          style={
            {
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              animationDelay: `${p.delay}ms`,
              animationDuration: `${p.duration}ms`,
              "--drift": `${p.drift}px`,
              "--spin-x": `${p.spinX}deg`,
              "--spin-z": `${p.spinZ}deg`,
            } as React.CSSProperties
          }
        >
          <PokerChip className="h-full w-full drop-shadow-md" body={p.color.body} edge={p.color.edge} />
        </div>
      ))}
    </div>
  )
}
