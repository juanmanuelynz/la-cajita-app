// Palos de la baraja española en una sola tinta (currentColor), para tamaños
// chicos como el encabezado de Truco. La carta española dibuja los suyos a
// color (SuitPip en spanish-card.tsx).

import type { Suit } from "@/lib/truco/engine"

export function SuitGlyph({ suit, className }: { suit: Suit; className?: string }) {
  return (
    <svg viewBox="-12 -12 24 24" className={className} fill="currentColor" aria-hidden>
      {suit === "oro" && (
        <>
          <circle r="10" fill="none" stroke="currentColor" strokeWidth="2.4" />
          <circle r="5.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle r="1.8" />
        </>
      )}
      {suit === "copa" && (
        <path d="M-8.5-10h17c0 8.5-3.4 12-8.5 12s-8.5-3.5-8.5-12z M-1.8 2h3.6v5h-3.6z M-6.5 11c0-3.2 2.6-4.2 6.5-4.2s6.5 1 6.5 4.2z" />
      )}
      {suit === "espada" && (
        <>
          <path d="M0-11.5l3 3.4v11.3h-6v-11.3z M-7.5 3.4h15v2.8h-15z M-1.7 6.2h3.4v4.2h-3.4z" />
          <circle cy="11.2" r="1.9" />
        </>
      )}
      {suit === "basto" && <path d="M-2.6 11l-3-18.5c0-5.2 11.2-5.2 11.2 0L2.6 11z" />}
    </svg>
  )
}
