"use client"

import { useCallback, useEffect, useState } from "react"

// Dos cartas boca abajo sobre la mesa que cada tanto se levantan un poco,
// como un jugador de hold'em espiando sus cartas. CSS 3D, sin librerías.
// En cada vuelta (mientras están boca abajo) se reparte una mano nueva.

type Suit = "♠" | "♥" | "♦" | "♣"
type Card = { rank: string; suit: Suit }

const RANKS = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"]
const SUITS: Suit[] = ["♠", "♥", "♦", "♣"]

/** Dos cartas distintas al azar de un mazo de 52. */
function dealHand(): [Card, Card] {
  const a = Math.floor(Math.random() * 52)
  let b = Math.floor(Math.random() * 51)
  if (b >= a) b++
  const card = (i: number): Card => ({ rank: RANKS[i % 13], suit: SUITS[Math.floor(i / 13)] })
  return [card(a), card(b)]
}

const isRed = (s: Suit) => s === "♥" || s === "♦"

function PlayingCard({
  card,
  className,
  delayMs,
  onCycle,
}: {
  card: Card
  className: string
  delayMs: number
  onCycle?: () => void
}) {
  const color = isRed(card.suit) ? "text-rose-600" : "text-slate-900"
  return (
    <div className={`hole-card-slot ${className}`}>
      <div className="hole-card" style={{ animationDelay: `${delayMs}ms` }} onAnimationIteration={onCycle}>
        <div className="hole-card-back">
          <span>♠</span>
        </div>
        <div className={`hole-card-face ${color}`}>
          <span className="hole-card-corner">
            {card.rank}
            <br />
            {card.suit}
          </span>
          <span className="hole-card-pip">{card.suit}</span>
        </div>
      </div>
    </div>
  )
}

export function HoleCards() {
  // Arranca con una mano fija (igual en server y cliente, evita diferencias
  // de hidratación) y después reparte al azar.
  const [hand, setHand] = useState<[Card, Card]>([
    { rank: "A", suit: "♠" },
    { rank: "A", suit: "♥" },
  ])
  const redeal = useCallback(() => setHand(dealHand()), [])
  useEffect(redeal, [redeal])

  return (
    <div className="hole-cards" aria-hidden>
      <div className="hole-cards-table">
        {/* La vuelta termina con ambas cartas boca abajo: ahí cambia la mano. */}
        <PlayingCard card={hand[0]} className="hole-card-left" delayMs={0} onCycle={redeal} />
        <PlayingCard card={hand[1]} className="hole-card-right" delayMs={140} />
      </div>
    </div>
  )
}
