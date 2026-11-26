import { describe, expect, it } from "vitest"
import { parseCards, seededRng } from "../lib/poker/cards"
import { REVIEW_CLOSE, reviewHand, reviewSpots, verdictFor } from "../lib/poker/review"
import { act, createTable, DEFAULT_CONFIG, startHand, type TableState } from "../lib/poker/table"

const names = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `b${i}`, name: `P${i}` }))

describe("Repaso de la mano", () => {
  it("encuentra los momentos en que te apostaron, con lo que había que pagar y el pozo", () => {
    // Con luz $100, 2 jugadores: pozo $200 al empezar. Habla primero el 1.
    let t: TableState = startHand(createTable({ ...DEFAULT_CONFIG }, names(2)), seededRng(1), {
      holes: { 0: parseCards("Ah Kh"), 1: parseCards("7c 2d") },
      board: parseCards("Qs Js 4h 3d 9c"),
    })
    t = act(t, { type: "check" }) // 1 pasa
    t = act(t, { type: "check" }) // 0 pasa → flop
    t = act(t, { type: "raise", to: 200 }) // 1 apuesta $200
    t = act(t, { type: "call" }) // 0 paga → turn
    t = act(t, { type: "raise", to: 600 }) // 1 apuesta $600
    t = act(t, { type: "fold" }) // 0 se va
    const spots = reviewSpots(t.hand!, 0, "luz", 200)
    expect(spots.map((s) => [s.street, s.toCall, s.pot, s.played])).toEqual([
      ["flop", 200, 400, "call"],
      ["turn", 600, 1200, "fold"],
    ])
    expect(spots[0].needed).toBeCloseTo(200 / 600)
    expect(spots[1].needed).toBeCloseTo(600 / 1800)
    // El que apostó no tiene nada que repasar.
    expect(reviewSpots(t.hand!, 1, "luz", 200)).toEqual([])
  })

  it("con ciegas, la grande ya cuenta como apuesta: pagar una subida cuesta la diferencia", () => {
    const blinds = { ...DEFAULT_CONFIG, structure: "ciegas" as const }
    // 3 jugadores, botón 0 → chica 1 ($100), grande 2 ($200). Habla primero el 0.
    let t = startHand(createTable(blinds, names(3)), seededRng(1))
    t = act(t, { type: "raise", to: 600 }) // 0 sube a $600
    t = act(t, { type: "fold" }) // 1 se va
    t = act(t, { type: "call" }) // 2 paga $400
    const [s] = reviewSpots(t.hand!, 2, "ciegas", 200)
    expect(s).toMatchObject({ street: "preflop", toCall: 400, pot: 900, played: "call" })
  })

  it("el veredicto: bien, mal o da casi lo mismo", () => {
    expect(verdictFor("call", 0.5, 0.25)).toBe("bien")
    expect(verdictFor("fold", 0.5, 0.25)).toBe("mal")
    expect(verdictFor("call", 0.1, 0.25)).toBe("mal")
    expect(verdictFor("fold", 0.1, 0.25)).toBe("bien")
    expect(verdictFor("raise", 0.6, 0.3)).toBe("bien")
    expect(verdictFor("fold", 0.25 + REVIEW_CLOSE / 2, 0.25)).toBe("justo")
  })

  it("pagar con la escalera real hecha está bien, y contra sus cartas (se vieron) da 100%", () => {
    let t = startHand(createTable({ ...DEFAULT_CONFIG }, names(2)), seededRng(1), {
      holes: { 0: parseCards("As Ks"), 1: parseCards("7c 2d") },
      board: parseCards("Qs Js Ts 3d 4c"),
    })
    for (let k = 0; k < 7; k++) t = act(t, { type: "check" })
    t = act(t, { type: "raise", to: 1000 }) // en el river el 1 pasó y el 0 (escalera real) apuesta
    t = act(t, { type: "call" }) // el 1 paga con nada
    const loser = reviewHand(t.hand!, 1, "luz", 200, seededRng(2), 400)
    expect(loser).toHaveLength(1)
    expect(loser[0].actual).toBe(0)
    expect(loser[0].verdict).toBe("mal")
    // Ahora al revés: el que tiene la escalera real paga.
    let u = startHand(createTable({ ...DEFAULT_CONFIG }, names(2)), seededRng(1), {
      holes: { 0: parseCards("7c 2d"), 1: parseCards("As Ks") },
      board: parseCards("Qs Js Ts 3d 4c"),
    })
    for (let k = 0; k < 7; k++) u = act(u, { type: "check" })
    u = act(u, { type: "raise", to: 1000 })
    u = act(u, { type: "call" })
    const [win] = reviewHand(u.hand!, 1, "luz", 200, seededRng(3), 400)
    expect(win.equity).toBe(1)
    expect(win.actual).toBe(1)
    expect(win.verdict).toBe("bien")
  })

  it("si el rival se fue antes de mostrar, no hay chance 'real'", () => {
    let t = startHand(createTable({ ...DEFAULT_CONFIG }, names(3)), seededRng(4))
    t = act(t, { type: "raise", to: 300 }) // 1 apuesta
    t = act(t, { type: "call" }) // 2 paga
    t = act(t, { type: "fold" }) // 0 se va
    const [s] = reviewHand(t.hand!, 2, "luz", 200, seededRng(5), 200)
    // Cuando habló el 2, el 0 todavía no se había ido: eran dos rivales.
    expect(s.opponents).toEqual([1, 0])
    // La mano sigue (no terminó): no se vio nada.
    expect(s.actual).toBeNull()
  })
})
