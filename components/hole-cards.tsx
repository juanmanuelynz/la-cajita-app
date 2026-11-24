"use client"

import { useCallback, useEffect, useState } from "react"
import { LeafMark } from "@/components/training/playing-card"
import { playSound } from "@/lib/sounds"

// Dos cartas boca abajo sobre la mesa. Cada tanto se "espían" como en
// hold'em: el extremo cercano se dobla hacia arriba y se ve la esquina.
// Una carta no se puede curvar en CSS, así que cada carta está hecha de
// franjas encadenadas con bisagra; cada franja gira un poco más que la
// anterior y juntas forman la curva. Sin librerías.

type Suit = "♠" | "♥" | "♦" | "♣"
type Card = { rank: string; suit: Suit }

const RANKS = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"]
const SUITS: Suit[] = ["♠", "♥", "♦", "♣"]

const CARD_W = 78
const CARD_H = 112
/** Ángulo de cada franja (desde el extremo lejano, que queda apoyado). */
const BEND_LEFT = [0, 0, 8, 16, 22, 28, 34, 38]
const BEND_RIGHT = [0, 0, 8, 16, 22, 28, 33, 37]
const SEGMENTS = BEND_LEFT.length
const SEG_H = CARD_H / SEGMENTS

/** Dos cartas distintas al azar de un mazo de 52. */
function dealHand(): [Card, Card] {
  const a = Math.floor(Math.random() * 52)
  let b = Math.floor(Math.random() * 51)
  if (b >= a) b++
  const card = (i: number): Card => ({ rank: RANKS[i % 13], suit: SUITS[Math.floor(i / 13)] })
  return [card(a), card(b)]
}

const isRed = (s: Suit) => s === "♥" || s === "♦"

function CardBack() {
  return (
    <div className="hole-card-back" style={{ height: CARD_H }}>
      <div className="card-back-felt">
        <LeafMark className="w-[50%]" />
      </div>
    </div>
  )
}

function CardFace({ card }: { card: Card }) {
  return (
    <div className={`hole-card-face ${isRed(card.suit) ? "text-[#e0564b]" : "text-zinc-900"}`} style={{ height: CARD_H }}>
      {/* Misma letra y colores que las cartas de Entrenar. */}
      <span className="hole-card-corner">
        <span className="hole-card-rank">{card.rank}</span>
        <span>{card.suit}</span>
      </span>
    </div>
  )
}

/** Franja `i` de la carta, con la franja siguiente colgando de su borde. */
function Segment({ i, card, angles }: { i: number; card: Card; angles: number[] }) {
  return (
    <div
      className="bend-seg"
      data-last={i === SEGMENTS - 1 || undefined}
      style={
        {
          top: i === 0 ? 0 : SEG_H,
          height: SEG_H + 1, // 1px de solape para que no se vean costuras (Safari las marca más)
          "--a": `${angles[i]}deg`,
          "--a-settle": `${angles[i] * 0.88}deg`,
          "--a-hold": `${angles[i] * 0.95}deg`,
          "--a-bounce": `${angles[i] * 0.12}deg`,
        } as React.CSSProperties
      }
    >
      {/* Dorso: la porción de la carta que le toca a esta franja */}
      <div className="bend-slice">
        <div style={{ position: "absolute", left: 0, right: 0, top: -i * SEG_H }}>
          <CardBack />
        </div>
      </div>
      {/* Cara: del otro lado, dada vuelta, por eso la porción va invertida */}
      <div className="bend-slice bend-slice-face">
        <div style={{ position: "absolute", left: 0, right: 0, top: -(SEGMENTS - 1 - i) * SEG_H }}>
          <CardFace card={card} />
        </div>
      </div>
      {i < SEGMENTS - 1 && <Segment i={i + 1} card={card} angles={angles} />}
    </div>
  )
}

function PlayingCard({
  card,
  side,
  onCycle,
}: {
  card: Card
  side: "left" | "right"
  onCycle?: () => void
}) {
  return (
    <div className={`hole-card-slot hole-card-${side}`}>
      <div
        className="hole-card"
        style={{ width: CARD_W, height: CARD_H }}
        onAnimationIteration={(e) => {
          // Cada franja dispara su evento: nos quedamos con uno solo por vuelta.
          if ((e.target as HTMLElement).dataset.last) onCycle?.()
        }}
      >
        {/* En reposo se ve la carta entera, sin franjas (Safari marca las uniones);
            las franjas aparecen solo mientras se dobla. */}
        <div className="hole-card-solid">
          <CardBack />
        </div>
        <Segment i={0} card={card} angles={side === "left" ? BEND_LEFT : BEND_RIGHT} />
      </div>
    </div>
  )
}

const DECK_SIZE = 20

/**
 * Mazo boca abajo que se mezcla en riffle: se abre en dos mitades y las
 * cartas vuelven intercaladas al centro, en bucle.
 */
function RiffleDeck() {
  return (
    <div className="riffle-deck">
      {Array.from({ length: DECK_SIZE }, (_, i) => {
        const side = i % 2 === 0 ? -1 : 1
        return (
          <div
            key={i}
            className="riffle-card"
            style={
              {
                "--x": `${side * (58 + (i % 4) * 3)}px`,
                "--r": `${side * (9 + (i % 3) * 2)}deg`,
                "--z": `${i * 0.6}px`,
                animationDelay: `${i * 25}ms`,
              } as React.CSSProperties
            }
          >
            <CardBack />
          </div>
        )
      })}
    </div>
  )
}

/**
 * `shuffling`: mientras se crea la partida, las dos cartas se van y aparece
 * un mazo que se mezcla en bucle (sirve como indicador de carga).
 */
export function HoleCards({ shuffling = false }: { shuffling?: boolean }) {
  // Arranca con una mano fija (igual en server y cliente, evita diferencias
  // de hidratación) y después reparte al azar.
  const [hand, setHand] = useState<[Card, Card]>([
    { rank: "A", suit: "♠" },
    { rank: "A", suit: "♥" },
  ])
  const redeal = useCallback(() => setHand(dealHand()), [])
  useEffect(redeal, [redeal])
  // El mazo suena mientras se mezcla; se corta cuando termina de crear.
  useEffect(() => (shuffling ? playSound("cardShuffle") : undefined), [shuffling])

  return (
    <div className="hole-cards" data-shuffling={shuffling || undefined} aria-hidden>
      <div className="hole-cards-table">
        {/* La vuelta termina con ambas cartas boca abajo: ahí cambia la mano. */}
        <PlayingCard card={hand[0]} side="left" onCycle={redeal} />
        <PlayingCard card={hand[1]} side="right" />
        {shuffling && <RiffleDeck />}
      </div>
    </div>
  )
}
