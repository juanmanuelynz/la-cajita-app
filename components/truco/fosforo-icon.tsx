import { MatchShapes } from "./fosforos"

/**
 * Los 5 fósforos del anotador (cuadrado con su diagonal), en currentColor como
 * los íconos de lucide. Es el botón del centro de la barra de Truco, como la
 * pica en Poker.
 */
export function FosforoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <MatchShapes />
    </svg>
  )
}
