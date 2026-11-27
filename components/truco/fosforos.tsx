// Fósforos del truco: los puntos se anotan de a 5, cuatro en cuadrado y el
// quinto cruzado en diagonal. Lo usan el ícono de la barra (una tinta), la
// lección "La partida" y el anotador (a color).

import { cn } from "@/lib/utils"

// Cada fósforo: [x1, y1, x2, y2] del palito (en un cuadro de 24×24) y la
// cabeza en la punta (x2, y2). Cada cabeza apunta a una esquina distinta y los
// palitos arrancan lejos de su esquina, así no se pegan.
const MATCHES = [
  [4, 17, 4, 7.2],
  [7, 4, 16.8, 4],
  [20, 7, 20, 16.8],
  [17, 20, 7.2, 20],
  [7.5, 16.5, 14.8, 9.2],
] as const

/** Los primeros `count` fósforos de un grupo (1 a 5), para meter en un SVG de 0 0 24 24. */
export function MatchShapes({
  count = 5,
  stick = "currentColor",
  head = "currentColor",
  lastClassName,
}: {
  count?: number
  stick?: string
  head?: string
  /** Clase para el último fósforo (el anotador lo va apagando al mantener apretado). */
  lastClassName?: string
}) {
  return (
    <>
      {MATCHES.slice(0, count).map(([x1, y1, x2, y2], i) => {
        const len = Math.hypot(x2 - x1, y2 - y1)
        const ux = (x2 - x1) / len
        const uy = (y2 - y1) / len
        const deg = (Math.atan2(uy, ux) * 180) / Math.PI
        // Cabeza alargada en la punta, en la dirección del palito.
        const hx = x2 + ux * 1.3
        const hy = y2 + uy * 1.3
        return (
          <g key={i} className={i === count - 1 ? lastClassName : undefined}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stick} strokeWidth="1.3" strokeLinecap="round" />
            <ellipse cx={hx} cy={hy} rx="2.1" ry="1.45" fill={head} transform={`rotate(${deg} ${hx} ${hy})`} />
          </g>
        )
      })}
    </>
  )
}

/** Madera y cabeza de fósforo de verdad. */
export const MATCH_STICK = "#e9cf9a"
export const MATCH_HEAD = "#c8432f"

/** `n` puntos en fósforos, de a grupos de 5. */
export function Fosforos({
  n,
  className,
  groupClassName,
  lastClassName,
}: {
  n: number
  className?: string
  groupClassName?: string
  /** Clase para el último fósforo de todos. */
  lastClassName?: string
}) {
  const groups: number[] = []
  for (let i = 0; i < n; i += 5) groups.push(Math.min(5, n - i))
  return (
    <div className={cn("flex flex-wrap gap-1", className)} role="img" aria-label={`${n} punto${n === 1 ? "" : "s"}`}>
      {groups.map((k, i) => (
        <svg key={i} viewBox="0 0 24 24" className={cn("size-10", groupClassName)} aria-hidden>
          <MatchShapes
            count={k}
            stick={MATCH_STICK}
            head={MATCH_HEAD}
            lastClassName={i === groups.length - 1 ? lastClassName : undefined}
          />
        </svg>
      ))}
    </div>
  )
}
