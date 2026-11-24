import { useId } from "react"
import { cn } from "@/lib/utils"
import { LeafPaths, leafTransform } from "@/components/leaf-mark"

// Ficha de poker en SVG. Dos variantes:
//  - <PokerChip>: a color, para celebraciones y decoración.
//  - <ChipSpinner>: monocromática (currentColor, con los detalles calados por
//    máscara, la hojita incluida) para reemplazar a los spinners — se ve bien sobre cualquier fondo.

const EDGE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]

export const CHIP_COLORS = [
  { body: "#10b981", edge: "#ecfdf5" }, // esmeralda (primary)
  { body: "#e11d48", edge: "#fff1f2" }, // rojo
  { body: "#1e293b", edge: "#f8fafc" }, // negro
  { body: "#2563eb", edge: "#eff6ff" }, // azul
  { body: "#eab308", edge: "#fefce8" }, // dorado
] as const

interface PokerChipProps {
  className?: string
  body?: string
  edge?: string
  /** Texto grande y en negrita en el centro (p. ej. el número de puesto) en lugar de la hojita. */
  label?: string
  style?: React.CSSProperties
}

// Los detalles finos (la hojita, el aro punteado, la canaleta) solo se dibujan
// si la ficha se ve de 30px o más: más chica no se distinguen y ensucian. Lo
// decide CSS (container query sobre el ancho de la ficha), sin props.
const DETAIL = "@max-[29px]:hidden"

/**
 * Ficha de arcilla como las de la mesa: cuerpo del color, 8 incrustaciones en
 * el borde, centro con aro impreso y la hojita, y un sombreado diagonal con
 * brillo arriba a la izquierda (el mismo relieve que la cara de las cartas).
 */
export function PokerChip({
  className,
  body = CHIP_COLORS[0].body,
  edge = CHIP_COLORS[0].edge,
  label,
  style,
}: PokerChipProps) {
  const id = useId()
  const shade = `${id}-shade`
  const gloss = `${id}-gloss`
  return (
    <span className={cn("@container inline-block shrink-0", className)} style={style} aria-hidden>
      <svg viewBox="0 0 100 100" className="block h-full w-full overflow-visible">
        <defs>
          <linearGradient id={shade} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.3" />
            <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.6" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.32" />
          </linearGradient>
          <radialGradient id={gloss} cx="0.36" cy="0.3" r="0.6">
            <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill={body} />
        {EDGE_ANGLES.map((a) => (
          <rect key={a} x="43.5" y="2" width="13" height="14" rx="1.5" fill={edge} transform={`rotate(${a} 50 50)`} />
        ))}
        {/* Canaleta entre el borde y el centro. */}
        <circle className={DETAIL} cx="50" cy="50" r="36.5" fill="none" stroke="#000" strokeOpacity="0.18" strokeWidth="1.5" />
        {/* Centro: un poco más oscuro, con el aro impreso. */}
        <circle cx="50" cy="50" r="32" fill={body} />
        <circle cx="50" cy="50" r="32" fill="#000" fillOpacity="0.14" />
        <circle cx="50" cy="50" r="31" fill="none" stroke={edge} strokeWidth="2.4" />
        <circle
          className={DETAIL}
          cx="50"
          cy="50"
          r="26.5"
          fill="none"
          stroke={edge}
          strokeOpacity="0.55"
          strokeWidth="1.2"
          strokeDasharray="3 3.2"
        />
        {label ? (
          <text x="50" y="51" textAnchor="middle" dominantBaseline="central" fontSize={50} fontWeight={800} fill={edge}>
            {label}
          </text>
        ) : (
          // La hojita de La Cajita, como en el dorso de las cartas.
          <g className={DETAIL} transform={leafTransform(50, 50, 34)}>
            <LeafPaths fill={edge} />
          </g>
        )}
        {/* Relieve: brillo arriba a la izquierda, sombra abajo a la derecha, y el canto. */}
        <circle cx="50" cy="50" r="48" fill={`url(#${shade})`} />
        <circle cx="50" cy="50" r="32" fill={`url(#${gloss})`} />
        <circle cx="50" cy="50" r="47.5" fill="none" stroke="#000" strokeOpacity="0.28" strokeWidth="1" />
      </svg>
    </span>
  )
}

/** Silueta de ficha en currentColor, sin animación. */
export function ChipGlyph({ className }: { className?: string }) {
  const maskId = useId()
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <defs>
        <mask id={maskId}>
          <rect width="100" height="100" fill="white" />
          {EDGE_ANGLES.map((a) => (
            <rect
              key={a}
              x="44"
              y="2"
              width="12"
              height="16"
              rx="2"
              fill="black"
              transform={`rotate(${a} 50 50)`}
            />
          ))}
          <circle cx="50" cy="50" r="28" fill="none" stroke="black" strokeWidth="7" />
          <g className={DETAIL} transform={leafTransform(50, 50, 34)}>
            <LeafPaths fill="black" />
          </g>
        </mask>
      </defs>
      <circle cx="50" cy="50" r="48" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  )
}

/** Ficha que gira sobre su eje: reemplazo de los spinners de carga. */
export function ChipSpinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={cn("@container block shrink-0 [perspective:200px]", className)}
    >
      <ChipGlyph className="block h-full w-full animate-chip-flip" />
    </span>
  )
}
