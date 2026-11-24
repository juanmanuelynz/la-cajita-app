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
