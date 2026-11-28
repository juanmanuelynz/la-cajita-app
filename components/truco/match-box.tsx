import type { CSSProperties, ReactNode } from "react"
import { LogoType } from "@/components/logo-type"
import { MATCH_HEAD, MATCH_STICK } from "./fosforos"
import { LeafMark } from "@/components/leaf-mark"

// Cajita de fósforos en 3D con CSS, para el login de Truco (el de Poker es el
// maletín de fichas, components/chip-case.tsx). Cerrada flota y se balancea;
// con `open` el cajón sale de costado, con las cabezas de los fósforos
// primero, y saltan algunos fósforos afuera.

const W = 184 // largo
const D = 108 // ancho
const H = 30 // alto
const DRAWER_OUT = 104 // cuánto sale el cajón

// Fósforos acostados en el cajón, a lo largo, con la cabeza del lado que sale.
const LYING = Array.from({ length: 11 }, (_, i) => ({ top: 6 + i * 8.6, shift: (i * 7) % 5 }))

// Fósforos que saltan al abrir: un abanico hacia arriba, del lado del cajón.
const BURST = Array.from({ length: 7 }, (_, i) => {
  const angle = (-150 + i * 20) * (Math.PI / 180)
  const dist = 90 + (i % 3) * 20
  return {
    bx: `${Math.cos(angle) * dist}px`,
    by: `${Math.sin(angle) * dist}px`,
    br: `${(i % 2 ? 1 : -1) * (200 + i * 50)}deg`,
    delay: 380 + (i % 4) * 50,
  }
})

function Face({
  w,
  h,
  transform,
  className = "",
  children,
}: {
  w: number
  h: number
  transform: string
  className?: string
  children?: ReactNode
}) {
  return (
    <div
      className={`mbox-face ${className}`}
      style={{ width: w, height: h, marginLeft: -w / 2, marginTop: -h / 2, transform }}
    >
      {children}
    </div>
  )
}

/** Un fósforo suelto (palito y cabeza), en diagonal dentro de su cuadro. */
function LooseMatch() {
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full drop-shadow-md" aria-hidden>
      <line x1="5" y1="19" x2="17" y2="7" stroke={MATCH_STICK} strokeWidth="1.6" strokeLinecap="round" />
      <ellipse cx="18" cy="6" rx="2.6" ry="1.8" fill={MATCH_HEAD} transform="rotate(-45 18 6)" />
    </svg>
  )
}

/** La etiqueta de la tapa: LA CAJITA entre dos hojitas y, abajo, TRUCO. */
function Label() {
  return (
    <div className="mbox-label">
      <div className="mbox-label-inner">
        <div className="flex items-center gap-2">
          <LeafMark className="h-5 w-5 text-[#2f62ad]" />
          <LogoType as="span" className="text-[22px] text-[#16325e]" />
          <LeafMark className="h-5 w-5 text-[#2f62ad]" />
        </div>
        <span className="mbox-label-sub">Truco</span>
      </div>
    </div>
  )
}

export function MatchBox({ open }: { open: boolean }) {
  return (
    <div className="case-scene relative mx-auto flex h-40 w-72 items-center justify-center" aria-hidden>
      <div className="mbox-glow" style={{ opacity: open ? 1 : 0.4, transform: open ? "scale(1.2)" : "scale(1)" }} />
      <div className="case-float">
        <div className="case-sway">
          <div
            className="mbox-tilt"
            data-state={open ? "open" : "closed"}
            style={{ "--drawer-out": `${DRAWER_OUT}px` } as CSSProperties}
          >
            {/* Cajón: sale por la derecha. */}
            <div className="mbox-drawer">
              <Face w={W - 4} h={D - 4} transform={`translate3d(0, -3px, 0) rotateX(90deg)`} className="mbox-tray">
                {LYING.map((m, i) => (
                  <span key={i} className="mbox-lying" style={{ top: m.top, left: 10 + m.shift }} />
                ))}
              </Face>
              <Face w={W - 4} h={H - 5} transform={`translate3d(0, ${-H / 2}px, ${D / 2 - 2}px)`} className="mbox-drawer-wall" />
              <Face w={W - 4} h={H - 5} transform={`translate3d(0, ${-H / 2}px, ${-D / 2 + 2}px)`} className="mbox-drawer-wall" />
              <Face
                w={D - 4}
                h={H - 5}
                transform={`translate3d(${W / 2 - 2}px, ${-H / 2}px, 0) rotateY(90deg)`}
                className="mbox-drawer-wall"
              />
              <Face
                w={D - 4}
                h={H - 5}
                transform={`translate3d(${-W / 2 + 2}px, ${-H / 2}px, 0) rotateY(90deg)`}
                className="mbox-drawer-wall"
              />
            </div>

            {/* Funda: tapa con la etiqueta, piso y los dos costados de raspar. */}
            <Face w={W} h={D} transform={`translate3d(0, ${-H}px, 0) rotateX(90deg)`} className="mbox-sleeve">
              <Label />
            </Face>
            <Face w={W} h={D} transform="rotateX(-90deg)" className="mbox-sleeve" />
            <Face w={W} h={H} transform={`translate3d(0, ${-H / 2}px, ${D / 2}px)`} className="mbox-side">
              <span className="mbox-striker" />
            </Face>
            <Face w={W} h={H} transform={`translate3d(0, ${-H / 2}px, ${-D / 2}px) rotateY(180deg)`} className="mbox-side">
              <span className="mbox-striker" />
            </Face>
          </div>
        </div>
      </div>
      {open &&
        BURST.map((b, i) => (
          <span
            key={i}
            className="cajita-burst mbox-burst"
            style={
              {
                "--bx": b.bx,
                "--by": b.by,
                "--br": b.br,
                animationDelay: `${b.delay}ms`,
              } as CSSProperties
            }
          >
            <LooseMatch />
          </span>
        ))}
    </div>
  )
}
