import { describe, expect, it } from "vitest"
import { ringLayout } from "../components/training/ring-layout"

// Tamaños parecidos a los reales: cartelito + jugada + ficha, o cartas boca arriba (hasta 5).
function rng(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
}

describe("ringLayout", () => {
  it("nunca encima lugares ni el centro, ni se sale de los costados", () => {
    const r = rng(7)
    for (let k = 0; k < 2000; k++) {
      const width = 300 + Math.floor(r() * 81)
      const n = 2 + Math.floor(r() * 7)
      const boxes = Array.from({ length: n }, () => ({ w: 70 + r() * 70, h: 50 + r() * 60 }))
      const hero = Math.floor(r() * n)
      const center = { w: 100 + r() * 100, h: 40 + r() * 40 }
      const l = ringLayout(width, boxes, hero, center)
      expect(l.center).not.toBeNull()
      const all = [...l.seats.map((p, i) => ({ ...p, ...boxes[i] })), { ...l.center!, ...center }]
      for (const a of all) {
        expect(a.x - a.w / 2).toBeGreaterThanOrEqual(0)
        expect(a.x + a.w / 2).toBeLessThanOrEqual(width)
        expect(a.y - a.h / 2).toBeGreaterThanOrEqual(0)
        expect(a.y + a.h / 2).toBeLessThanOrEqual(l.height)
      }
      for (let i = 0; i < all.length; i++)
        for (let j = i + 1; j < all.length; j++) {
          const a = all[i], b = all[j]
          const apart = Math.abs(a.x - b.x) * 2 >= a.w + b.w || Math.abs(a.y - b.y) * 2 >= a.h + b.h
          expect(apart).toBe(true)
        }
      // Vos siempre abajo de todo.
      expect(Math.max(...l.seats.map((p) => p.y))).toBe(l.seats[hero].y)
    }
  })
})
