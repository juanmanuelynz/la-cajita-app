import { useId } from "react"

const SPADE =
  "M12 1.8C12 1.8 3.6 8.4 3.6 13.4C3.6 16.2 5.7 18 8.1 18C9.7 18 10.9 17.2 11.4 16.3C11.2 18.6 10.3 20.3 8.6 21.5V22.2H15.4V21.5C13.7 20.3 12.8 18.6 12.6 16.3C13.1 17.2 14.3 18 15.9 18C18.3 18 20.4 16.2 20.4 13.4C20.4 8.4 12 1.8 12 1.8Z"

/** Pica rellena en currentColor (la de lucide es solo contorno y en el botón verde quedaba liviana). */
export function SpadeGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d={SPADE} />
    </svg>
  )
}

/** La pica de 24×24 escalada `s` veces y centrada en el lienzo de 100×100. */
const spadeAt = (s: number) => `translate(${50 - 12 * s} ${49 - 12 * s}) scale(${s})`
const STRIPES = [0, 60, 120, 180, 240, 300]

/**
 * Ficha de poker con una pica al centro, en currentColor: aro con 6 franjas
 * caladas y la pica sólida en el medio (el botón de Partidas).
 */
export function ChipSpadeGlyph({ className }: { className?: string }) {
  const maskId = useId()
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <defs>
        <mask id={maskId}>
          <rect width="100" height="100" fill="white" />
          {STRIPES.map((a) => (
            <rect key={a} x="42.5" y="1" width="15" height="15" rx="1.5" fill="black" transform={`rotate(${a} 50 50)`} />
          ))}
          <circle cx="50" cy="50" r="34" fill="black" />
        </mask>
      </defs>
      <circle cx="50" cy="50" r="48" fill="currentColor" mask={`url(#${maskId})`} />
      <path d={SPADE} fill="currentColor" transform={spadeAt(2.1)} />
    </svg>
  )
}
