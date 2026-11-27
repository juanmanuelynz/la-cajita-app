/**
 * El fósforo del anotador (los puntos del truco se anotan con fósforos), en
 * currentColor como los íconos de lucide. Es el botón del centro de la barra
 * de Truco, como la pica en Poker.
 */
export function FosforoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M5.2 21.2l-1.4-1.4L14.4 9.2l1.4 1.4z" />
      <ellipse cx="16.6" cy="7.4" rx="3.1" ry="2.5" transform="rotate(-45 16.6 7.4)" />
      <path fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" d="M19.6 2.6c1.6 1.4 1.6 3 .6 4.2" />
    </svg>
  )
}
