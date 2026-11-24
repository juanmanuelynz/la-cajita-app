// La hojita de La Cajita (dorso de las cartas y centro de las fichas).
// Hoja de 7 folíolos: cada uno es la misma gota girada desde la base del tallo.
const LEAFLETS = [
  [0, 1],
  [-27, 0.86],
  [27, 0.86],
  [-56, 0.66],
  [56, 0.66],
  [-86, 0.42],
  [86, 0.42],
] as const

/** Los trazos de la hoja, para meter dentro de otro SVG (ocupa x −0,6…0,6, y −1,03…0,32). */
export function LeafPaths({ fill }: { fill?: string }) {
  return (
    <>
      {LEAFLETS.map(([deg, len]) => (
        <path
          key={deg}
          fill={fill}
          transform={`rotate(${deg}) scale(${len})`}
          d="M0 0 C .13 -.25 .12 -.75 0 -1 C -.12 -.75 -.13 -.25 0 0 Z"
        />
      ))}
      <path fill={fill} d="M-.02 0 L.02 0 L.012 .3 L-.012 .3 Z" />
    </>
  )
}

/** Transform que centra la hoja en (cx, cy) con un alto de `height` unidades. */
export function leafTransform(cx: number, cy: number, height: number) {
  const s = height / 1.35
  return `translate(${cx} ${cy + 0.355 * s}) scale(${s})`
}

/** La hojita del dorso (SVG sin ids, así se puede repetir mil veces en la página). */
export function LeafMark({ className }: { className?: string }) {
  return (
    <svg viewBox="-0.6 -1.03 1.2 1.35" className={className} fill="currentColor" aria-hidden>
      <LeafPaths />
    </svg>
  )
}
