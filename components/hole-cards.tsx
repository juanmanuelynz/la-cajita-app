"use client"

import { useEffect, useState } from "react"

// Dos cartas boca abajo sobre la mesa que cada tanto se levantan un poco,
// como un jugador de hold'em espiando sus cartas. CSS 3D, sin librerías.

type Card = { rank: string; suit: "♠" | "♥" | "♦" | "♣" }

// Manos premium: cada vez que se monta, espía una distinta.
const HANDS: [Card, Card][] = [
  [{ rank: "A", suit: "♠" }, { rank: "A", suit: "♥" }],
  [{ rank: "K", suit: "♣" }, { rank: "K", suit: "♦" }],
  [{ rank: "A", suit: "♠" }, { rank: "K", suit: "♠" }],
  [{ rank: "Q", suit: "♥" }, { rank: "Q", suit: "♣" }],
  [{ rank: "J", suit: "♦" }, { rank: "J", suit: "♠" }],
  [{ rank: "A", suit: "♦" }, { rank: "Q", suit: "♦" }],
]

const isRed = (s: Card["suit"]) => s === "♥" || s === "♦"

function PlayingCard({ card, className, delayMs }: { card: Card; className: string; delayMs: number }) {
  const color = isRed(card.suit) ? "text-rose-600" : "text-slate-900"
  return (
    <div className={`hole-card-slot ${className}`}>
      <div className="hole-card" style={{ animationDelay: `${delayMs}ms` }}>
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
  // Arranca con AA (igual en server y cliente) y después elige una al azar.
  const [hand, setHand] = useState(HANDS[0])
  useEffect(() => {
    setHand(HANDS[Math.floor(Math.random() * HANDS.length)])
  }, [])

  return (
    <div className="hole-cards" aria-hidden>
      <div className="hole-cards-table">
        <PlayingCard card={hand[0]} className="hole-card-left" delayMs={0} />
        <PlayingCard card={hand[1]} className="hole-card-right" delayMs={140} />
      </div>
    </div>
  )
}
