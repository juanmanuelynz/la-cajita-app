// Cálculo puro de dónde va cada lugar en la mesa redonda (RingTable).

export interface Box {
  w: number
  h: number
}
export interface Layout {
  width: number
  height: number
  /** Centro de cada lugar, en el orden de `seats`. */
  seats: { x: number; y: number }[]
  center: { x: number; y: number } | null
  felt: { x: number; y: number; rx: number; ry: number }
}

/** Separación mínima entre dos cosas de la mesa y con el borde. */
const GAP_PX = 4
const PAD_PX = 2

/**
 * Dónde va cada lugar para que nada se pise. Los lugares van sobre una elipse,
 * a la misma distancia uno de otro medida sobre el borde (vos abajo), y la
 * elipse se estira hacia abajo hasta que ningún cartelito, carta, ficha o el
 * centro se toquen: con más gente o cartas boca arriba la mesa queda más alta,
 * nunca encimada. Puro (sin DOM) para poder probarlo.
 */
export function ringLayout(width: number, boxes: Box[], hero: number, center: Box | null): Layout {
  const n = boxes.length
  const cx = width / 2
  const rx = width * 0.41
  const hit = (a: { x: number; y: number }, A: Box, b: { x: number; y: number }, B: Box) =>
    Math.abs(a.x - b.x) * 2 < A.w + B.w + 2 * GAP_PX && Math.abs(a.y - b.y) * 2 < A.h + B.h + 2 * GAP_PX

  const place = (ry: number) => {
    // Largo del borde de la elipse, de a pasitos, arrancando abajo (90°) y yendo hacia la izquierda.
    const STEPS = 720
    const pts: { x: number; y: number; len: number }[] = []
    let len = 0
    for (let i = 0; i <= STEPS; i++) {
      const t = Math.PI / 2 + (i / STEPS) * 2 * Math.PI
      const p = { x: rx * Math.cos(t), y: ry * Math.sin(t), len }
      if (i > 0) len += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y)
      p.len = len
      pts.push(p)
    }
    return boxes.map((box, i) => {
      const target = (len * ((i - hero + n) % n)) / n
      let j = 0
      while (j < STEPS && pts[j + 1].len < target) j++
      const p = pts[j]
      // Sin salirse de los costados.
      const x = Math.min(width - PAD_PX - box.w / 2, Math.max(PAD_PX + box.w / 2, cx + p.x))
      return { x, y: p.y }
    })
  }

  let best: Layout | null = null
  for (let ry = Math.max(120, width * 0.36); ry <= 1200; ry += 4) {
    const pos = place(ry)
    let ok = true
    for (let a = 0; a < n && ok; a++)
      for (let b = a + 1; b < n && ok; b++) if (hit(pos[a], boxes[a], pos[b], boxes[b])) ok = false
    if (!ok) continue
    // El centro (pozo, mesa) lo más cerca posible del medio, en un hueco libre.
    let c: { x: number; y: number } | null = null
    if (center) {
      for (let d = 0; d <= ry && !c; d += 2) {
        for (const y of d === 0 ? [0] : [-d, d]) {
          const cand = { x: cx, y }
          if (pos.every((p, i) => !hit(cand, center, p, boxes[i]))) {
            c = cand
            break
          }
        }
      }
      if (!c || center.w > width - 2 * PAD_PX) continue
    }
    // Correr todo para que arranque arriba y medir el alto.
    const tops = pos.map((p, i) => p.y - boxes[i].h / 2)
    if (c && center) tops.push(c.y - center.h / 2)
    const bottoms = pos.map((p, i) => p.y + boxes[i].h / 2)
    if (c && center) bottoms.push(c.y + center.h / 2)
    const dy = PAD_PX - Math.min(-ry, ...tops)
    best = {
      width,
      height: Math.max(...bottoms) + dy + PAD_PX,
      seats: pos.map((p) => ({ x: p.x, y: p.y + dy })),
      center: c && { x: c.x, y: c.y + dy },
      felt: { x: cx, y: dy, rx: width / 2 - PAD_PX, ry: ry * 1.08 },
    }
    break
  }
  // No debería pasar: sin lugar ni estirando, queda lo último (se prueba en tests/ring-layout.test.ts).
  return best ?? { width, height: 340, seats: place(1200).map((p) => ({ ...p, y: p.y + 1200 })), center: null, felt: { x: cx, y: 1200, rx: width / 2, ry: 1200 } }
}

