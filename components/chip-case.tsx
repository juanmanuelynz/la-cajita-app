import { CHIP_COLORS, PokerChip } from "@/components/poker-chip"
import { LeafMark } from "@/components/leaf-mark"

// Maletín de aluminio de fichas de poker, en 3D con CSS (sin Three.js).
// Cerrado flota y se balancea; con `open` se sueltan las trabas, se levanta
// la tapa, se ven las filas de fichas y saltan algunas afuera.

const W = 200 // ancho
const D = 120 // profundidad
const H = 36 // alto de la base
const L = 18 // alto de la tapa

// Filas de fichas vistas de canto: color del cuerpo y de las incrustaciones.
const ROW_COLORS = [
  { body: "#f1f5f9", edge: "#2563eb" },
  ...[1, 3, 0, 2].map((i) => CHIP_COLORS[i]),
]

// Fichas que salen disparadas al abrir: un abanico hacia arriba.
const BURST = Array.from({ length: 9 }, (_, i) => {
  const angle = (-160 + i * 17.5) * (Math.PI / 180)
  const dist = 100 + (i % 3) * 22
  return {
    bx: `${Math.cos(angle) * dist}px`,
    by: `${Math.sin(angle) * dist}px`,
    br: `${(i % 2 ? 1 : -1) * (180 + i * 40)}deg`,
    delay: 450 + (i % 4) * 45,
    color: CHIP_COLORS[i % CHIP_COLORS.length],
  }
})

function Face({
  w,
  h,
  transform,
  className = "",
  children,
  style,
}: {
  w: number
  h: number
  transform: string
  className?: string
  children?: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div
      className={`case-face ${className}`}
      style={{ width: w, height: h, marginLeft: -w / 2, marginTop: -h / 2, transform, ...style }}
    >
      {children}
    </div>
  )
}

/** Una fila de fichas de canto: cada ficha con su incrustación al medio, separadas por una línea oscura. */
function ChipRow({ body, edge }: { body: string; edge: string }) {
  return (
    <div
      className="case-chip-row"
      style={{
        backgroundColor: body,
        backgroundImage: [
          // volumen de cilindro: luz arriba, sombra abajo
          "linear-gradient(180deg, rgb(255 255 255 / 0.4), transparent 45%, rgb(0 0 0 / 0.35))",
          // separación entre fichas
          "repeating-linear-gradient(90deg, transparent 0 4px, rgb(0 0 0 / 0.5) 4px 5px)",
          // incrustaciones del canto, una ficha sí y otra no
          `repeating-linear-gradient(90deg, ${edge} 0 4px, transparent 4px 10px)`,
        ].join(","),
        backgroundSize: "100% 100%, 100% 100%, 100% 34%",
        backgroundPosition: "0 0, 0 0, 0 50%",
        backgroundRepeat: "no-repeat",
      }}
    />
  )
}

/** Mazo cerrado con el dorso de La Cajita. */
function Deck() {
  return (
    <div className="case-deck">
      <div className="card-back-felt card-back-felt-mini rounded-[2px]">
        <LeafMark className="w-[34%]" />
      </div>
    </div>
  )
}

function Latch({ x, open }: { x: number; open: boolean }) {
  return (
    <>
      {/* placa fija sobre la base */}
      <Face w={20} h={14} transform={`translate3d(${x}px, 9px, ${D / 2 + 1}px)`} className="case-latch-plate" />
      {/* traba: gira hacia adelante sobre su borde inferior */}
      <Face
        w={12}
        h={14}
        transform={`translate3d(${x}px, 0px, ${D / 2 + 2}px) rotateX(${open ? -130 : 0}deg)`}
        className="case-latch"
        style={{ transformOrigin: "50% 100%" }}
      />
    </>
  )
}

export function ChipCase({ open }: { open: boolean }) {
  return (
    <div className="case-scene relative mx-auto flex h-56 w-72 items-center justify-center" aria-hidden>
      <div className="cajita-glow" style={{ opacity: open ? 1 : 0.4, transform: open ? "scale(1.2)" : "scale(1)" }} />
      <div className="case-float">
        <div className="case-sway">
          <div className="case-tilt" data-state={open ? "open" : "closed"}>
            {/* Base */}
            <Face w={W} h={D} transform="rotateX(90deg)" className="case-tray">
              <div className="flex h-full gap-1.5 p-1.5">
                <div className="flex flex-1 flex-col justify-between">
                  {ROW_COLORS.map((c) => (
                    <ChipRow key={c.body} body={c.body} edge={c.edge} />
                  ))}
                </div>
                <div className="flex w-12 flex-col items-center justify-center gap-1.5">
                  <Deck />
                  <Deck />
                  <div className="flex gap-1">
                    <div className="case-die">⚄</div>
                    <div className="case-die">⚂</div>
                  </div>
                </div>
              </div>
            </Face>
            <Face w={W} h={H} transform={`translate3d(0, ${H / 2}px, ${D / 2}px)`} className="case-metal case-wall" />
            <Face w={W} h={H} transform={`translate3d(0, ${H / 2}px, ${-D / 2}px) rotateY(180deg)`} className="case-metal case-wall" />
            <Face w={D} h={H} transform={`translate3d(${-W / 2}px, ${H / 2}px, 0) rotateY(-90deg)`} className="case-metal case-wall" />
            <Face w={D} h={H} transform={`translate3d(${W / 2}px, ${H / 2}px, 0) rotateY(90deg)`} className="case-metal case-wall" />
            <Face w={W} h={D} transform={`translate3d(0, ${H}px, 0) rotateX(-90deg)`} className="case-metal" />

            {/* Manija */}
            <Face w={72} h={12} transform={`translate3d(0, ${H * 0.5 - 4}px, ${D / 2 + 6}px) rotateX(90deg)`} className="case-handle" />
            <Face w={72} h={9} transform={`translate3d(0, ${H * 0.5 + 0.5}px, ${D / 2 + 12}px)`} className="case-handle" />

            <Latch x={-62} open={open} />
            <Latch x={62} open={open} />

            {/* Tapa: bisagra en el borde trasero */}
            <div className="case-lid">
              <Face w={W} h={D} transform={`translate3d(0, ${-L}px, ${D / 2}px) rotateX(90deg)`} className="case-metal case-lid-top">
                <span className="case-corner left-0 top-0" />
                <span className="case-corner right-0 top-0" />
                <span className="case-corner bottom-0 left-0" />
                <span className="case-corner bottom-0 right-0" />
                <div className="case-emblem">
                  <LeafMark className="h-[15px] w-[15px] text-emerald-400" />
                  <span>LA CAJITA</span>
                </div>
              </Face>
              {/* Adentro de la tapa: el paño del dorso de las cartas, con la hoja. */}
              <Face w={W} h={D} transform={`translate3d(0, -1px, ${D / 2}px) rotateX(-90deg)`} className="case-foam">
                <div className="card-back-felt case-felt">
                  <div className="flex flex-col items-center gap-1.5">
                    <LeafMark className="w-9" />
                    <span className="case-foam-label">LA CAJITA</span>
                  </div>
                </div>
              </Face>
              <Face w={W} h={L} transform={`translate3d(0, ${-L / 2}px, ${D}px)`} className="case-metal case-wall" />
              <Face w={W} h={L} transform={`translate3d(0, ${-L / 2}px, 0) rotateY(180deg)`} className="case-metal case-wall" />
              <Face w={D} h={L} transform={`translate3d(${-W / 2}px, ${-L / 2}px, ${D / 2}px) rotateY(-90deg)`} className="case-metal case-wall" />
              <Face w={D} h={L} transform={`translate3d(${W / 2}px, ${-L / 2}px, ${D / 2}px) rotateY(90deg)`} className="case-metal case-wall" />
            </div>
          </div>
        </div>
      </div>
      {open &&
        BURST.map((b, i) => (
          <span
            key={i}
            className="cajita-burst"
            style={
              {
                "--bx": b.bx,
                "--by": b.by,
                "--br": b.br,
                animationDelay: `${b.delay}ms`,
              } as React.CSSProperties
            }
          >
            <PokerChip className="h-full w-full drop-shadow-lg" body={b.color.body} edge={b.color.edge} />
          </span>
        ))}
    </div>
  )
}
