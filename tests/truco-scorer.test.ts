import { describe, expect, it } from "vitest"
import {
  addPoint,
  freshScorer,
  halves,
  parseScorer,
  removePoint,
  renameTeam,
  scorerWinner,
  setTarget,
  type ScorerState,
} from "../lib/truco/scorer"

const times = (s: ScorerState, n: number, f: (s: ScorerState) => ScorerState) => {
  for (let i = 0; i < n; i++) s = f(s)
  return s
}

describe("anotador de truco", () => {
  it("suma de a uno y al llegar al final cuenta la partida una sola vez", () => {
    let s = freshScorer({ target: 15 })
    s = times(s, 14, (x) => addPoint(x, 1))
    expect(scorerWinner(s)).toBeNull()
    s = addPoint(s, 1)
    expect(s.score).toEqual([0, 15])
    expect(scorerWinner(s)).toBe(1)
    expect(s.wins).toEqual([0, 1])
    // Terminada, no suma más.
    expect(addPoint(s, 0)).toBe(s)
    expect(addPoint(s, 1)).toBe(s)
  })

  it("restar el punto que ganó la partida la descuenta; volver a llegar la cuenta de nuevo", () => {
    let s = times(freshScorer({ target: 15 }), 15, (x) => addPoint(x, 0))
    expect(s.wins).toEqual([1, 0])
    s = removePoint(s, 0)
    expect(s.score).toEqual([14, 0])
    expect(s.wins).toEqual([0, 0])
    s = addPoint(s, 0)
    expect(s.wins).toEqual([1, 0])
  })

  it("no resta debajo de cero", () => {
    const s = freshScorer()
    expect(removePoint(s, 0)).toBe(s)
  })

  it("otra partida, cambiar el objetivo y renombrar conservan lo que corresponde", () => {
    let s = times(freshScorer({ target: 15 }), 15, (x) => addPoint(x, 0))
    s = renameTeam(s, 1, "  Los primos  ")
    const again = freshScorer(s)
    expect(again.score).toEqual([0, 0])
    expect(again.wins).toEqual([1, 0])
    expect(again.names).toEqual(["Nosotros", "Los primos"])
    const at30 = setTarget(again, 30)
    expect(at30.target).toBe(30)
    expect(setTarget(at30, 30)).toBe(at30)
    expect(renameTeam(s, 0, "   ").names[0]).toBe("Nosotros")
  })

  it("malas y buenas", () => {
    expect(halves(12, 30)).toEqual({ malas: 12, buenas: 0 })
    expect(halves(17, 30)).toEqual({ malas: 15, buenas: 2 })
    expect(halves(12, 15)).toEqual({ malas: 12, buenas: 0 })
  })

  it("lee lo guardado y se recupera si está roto", () => {
    const s = times(freshScorer(), 3, (x) => addPoint(x, 1))
    expect(parseScorer(JSON.stringify(s))).toEqual(s)
    expect(parseScorer(null)).toEqual(freshScorer())
    expect(parseScorer("{roto")).toEqual(freshScorer())
    expect(parseScorer(JSON.stringify({ target: 15, score: [99, -1] })).score).toEqual([0, 0])
    expect(parseScorer(JSON.stringify({ target: 15, score: [99, 3] })).score).toEqual([15, 3])
  })
})
