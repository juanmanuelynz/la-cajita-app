import { describe, expect, it } from "vitest"
import { parseCards, seededRng } from "../lib/poker/cards"
import { botAct, botDecide, botWantsCajita, decide, estimateEquity, seatPositions, type Situation } from "../lib/poker/bot"
import { vsAction, vsSpots } from "../lib/poker/preflop-vs"
import {
  act,
  canRequestCajita,
  chipsOf,
  createTable,
  DEFAULT_CONFIG,
  requestCajita,
  startHand,
  type Legal,
  type TableConfig,
  type TableState,
} from "../lib/poker/table"
import type { Variant } from "../lib/poker/variants"

const names = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `b${i}`, name: `Bot ${i}` }))
const HE: Variant = { game: "holdem", deck: "long" }

const legal = (over: Partial<Legal> = {}): Legal => ({
  seat: 0,
  canCheck: false,
  toCall: 500,
  canRaise: true,
  minTo: 1000,
  maxTo: 5000,
  ...over,
})
const sit = (over: Partial<Situation> = {}): Situation => ({ legal: legal(), pot: 1500, opponents: 1, equity: 0.5, chip: 100, ...over })

describe("Bots: equity", () => {
  it("se acerca a la equity conocida", () => {
    // AA contra una mano al azar antes del flop: ~85%.
    const aa = estimateEquity(parseCards("As Ad"), [], HE, 1, 4000, seededRng(1))
    expect(aa).toBeGreaterThan(0.81)
    expect(aa).toBeLessThan(0.89)
    // Escalera real hecha en el river: gana siempre.
    expect(estimateEquity(parseCards("As Ks"), parseCards("Qs Js Ts 2d 3c"), HE, 3, 300, seededRng(2))).toBe(1)
    // Más rivales, menos chance.
    const vs4 = estimateEquity(parseCards("As Ad"), [], HE, 4, 3000, seededRng(3))
    expect(vs4).toBeLessThan(aa - 0.15)
  })
})

describe("Bots: decisión", () => {
  it("nunca se retira si puede pasar gratis", () => {
    const rng = seededRng(5)
    for (let i = 0; i < 300; i++) {
      const d = decide(sit({ legal: legal({ canCheck: true, toCall: 0, minTo: 100 }), equity: rng() * 0.3 }), rng)
      expect(d.action.type).not.toBe("fold")
    }
  })

  it("se retira si no le alcanza para pagar y paga si le sobra", () => {
    const rng = seededRng(6)
    // Paga 500 por un pozo de 1500: necesita 25%.
    expect(decide(sit({ equity: 0.1 }), rng).action.type).toBe("fold")
    expect(decide(sit({ equity: 0.4, opponents: 2 }), rng).action.type).toBe("call")
  })

  it("con una mano muy buena casi siempre sube, y a veces disimula", () => {
    const rng = seededRng(7)
    const types = Array.from({ length: 400 }, () => decide(sit({ equity: 0.95 }), rng).action.type)
    const raises = types.filter((t) => t === "raise").length
    expect(types).not.toContain("fold")
    expect(raises).toBeGreaterThan(300)
    expect(raises).toBeLessThan(400)
  })

  it("las apuestas son válidas: entre la mínima y el all-in, de a $100", () => {
    const rng = seededRng(8)
    for (let i = 0; i < 500; i++) {
      const l = legal({ canCheck: rng() < 0.5, minTo: 100 * (1 + Math.floor(rng() * 20)) })
      l.maxTo = l.minTo + 100 * Math.floor(rng() * 50)
      if (l.canCheck) l.toCall = 0
      const d = decide(sit({ legal: l, equity: rng(), opponents: 1 + Math.floor(rng() * 5), pot: 100 * (3 + Math.floor(rng() * 80)) }), rng)
      if (d.action.type === "raise") {
        expect(d.action.to).toBeGreaterThanOrEqual(l.minTo)
        expect(d.action.to).toBeLessThanOrEqual(l.maxTo)
        expect(d.action.to % 100 === 0 || d.action.to === l.maxTo).toBe(true)
      }
    }
  })
})

describe("Bots: en la mesa", () => {
  it("una mesa solo de bots juega manos enteras sin errores y sin perder fichas", () => {
    const rng = seededRng(11)
    for (const variant of [HE, { game: "omaha", deck: "short" }, { game: "manhattan", deck: "short" }] as Variant[]) {
      let t: TableState = createTable({ ...DEFAULT_CONFIG, variants: [variant] }, names(variant.game === "manhattan" ? 6 : 5))
      let folds = 0
      let raises = 0
      // Pocas simulaciones por decisión: acá importa que jueguen sin errores, no que jueguen bien.
      for (let hand = 0; hand < 20; hand++) {
        t.seats.forEach((_, i) => {
          if (botWantsCajita(t, i)) t = requestCajita(t, i)
        })
        t = startHand(t, rng)
        const expected = t.seats.reduce((s, x) => s + x.cajitas * t.config.cajita, 0)
        let steps = 0
        while (t.hand!.toAct !== null) {
          const r = botAct(t, rng, 40)
          if (r.decision.action.type === "fold") folds++
          if (r.decision.action.type === "raise") raises++
          t = r.table
          expect(++steps).toBeLessThan(200)
        }
        expect(t.seats.reduce((s, _, i) => s + chipsOf(t, i), 0)).toBe(expected)
      }
      // Juegan: ni todo pasar ni todo retirarse.
      expect(folds).toBeGreaterThan(0)
      expect(raises).toBeGreaterThan(0)
    }
  }, 30000)

  it("con la mejor mano posible en el river nunca se retira", () => {
    const rng = seededRng(12)
    for (let i = 0; i < 30; i++) {
      let t = createTable({ ...DEFAULT_CONFIG }, names(2))
      t = startHand(t, rng, { holes: { 0: parseCards("7c 2d"), 1: parseCards("As Ks") }, board: parseCards("Qs Js Ts 3d 4c") })
      // Habla primero el 1 (izquierda del botón 0). Pasan hasta el river y el 0 apuesta.
      for (let k = 0; k < 6; k++) t = act(t, { type: "check" })
      t = act(t, { type: "check" }) // 1 en el river
      t = act(t, { type: "raise", to: 1500 }) // 0 farolea
      expect(botDecide(t, rng).action.type).not.toBe("fold")
    }
  })

  it("piden otra cajita solo cuando se quedan sin fichas", () => {
    const t = createTable({ ...DEFAULT_CONFIG }, names(2))
    t.seats[0].stack = 300
    expect(canRequestCajita(t, 0)).toBe(true)
    expect(botWantsCajita(t, 0)).toBe(false)
    t.seats[0].stack = 0
    expect(botWantsCajita(t, 0)).toBe(true)
  })

  it("deciden rápido aun en Manhattan con 6", () => {
    let t = createTable({ ...DEFAULT_CONFIG, variants: [{ game: "manhattan", deck: "short" }] }, names(6))
    t = startHand(t, seededRng(13))
    const t0 = performance.now()
    for (let i = 0; i < 10; i++) botDecide(t, seededRng(i))
    expect((performance.now() - t0) / 10).toBeLessThan(150)
  })
})

describe("Bots con ciegas: rangos de PokerStrategy en Hold'em Long", () => {
  const blinds = { ...DEFAULT_CONFIG, structure: "ciegas" as const }
  // Botón 0 → chica 1, grande 2, UTG 3, MP 4, CO 5.
  const fixedHoles = (h3: string, h4 = "8c 3d") => ({
    holes: {
      0: parseCards("9c 4d"),
      1: parseCards("Tc 5d"),
      2: parseCards("Jc 6d"),
      3: parseCards(h3),
      4: parseCards(h4),
      5: parseCards("Qc 7d"),
    },
    board: parseCards("2h 3h 4h 5h 6s"),
  })

  it("posiciones de 4 a 6 jugadores, como en Entrenar", () => {
    const pos = (n: number) => {
      const t = startHand(createTable(blinds, names(n)), seededRng(1))
      return t.hand!.players.map((p) => seatPositions(t.hand!)!.get(p.seat))
    }
    expect(pos(6)).toEqual(["SB", "BB", "UTG", "MP", "CO", "BU"])
    expect(pos(5)).toEqual(["SB", "BB", "MP", "CO", "BU"])
    expect(pos(4)).toEqual(["SB", "BB", "CO", "BU"])
  })

  it("UTG abre AA a 3 ciegas y tira 72", () => {
    let t = startHand(createTable(blinds, names(6)), seededRng(1), fixedHoles("As Ad"))
    let d = botDecide(t, seededRng(2))
    expect(d.source).toBe("pokerstrategy")
    expect(d.action).toEqual({ type: "raise", to: 600 })
    t = startHand(createTable(blinds, names(6)), seededRng(1), fixedHoles("7c 2d"))
    d = botDecide(t, seededRng(2))
    expect(d.action.type).toBe("fold")
  })

  it("contra la subida de UTG, MP hace lo que dice la fuente con cada combinación", () => {
    const spot = vsSpots().find((s) => s.kind === "vsOpen" && s.hero === "MP" && s.villain === "UTG")!
    for (const hand of ["As Ad", "Ks Kd", "Qs Qd", "Ah Kh", "Td 9d", "7c 2d"]) {
      // Cajitas grandes: con $2.000, resubir a $1.800 ya es casi todo y el bot va all-in.
      let t = startHand(createTable({ ...blinds, cajita: 10000 }, names(6)), seededRng(1), fixedHoles("Ac Ah", hand))
      t = act(t, { type: "raise", to: 600 }) // UTG abre
      const d = botDecide(t, seededRng(3))
      expect(d.source).toBe("pokerstrategy")
      const expected = vsAction(spot, parseCards(hand))
      expect(d.action.type).toBe(expected)
      if (expected === "raise" && d.action.type === "raise") expect(d.action.to).toBe(1800)
    }
  })

  it("con luz, en otros juegos o con 7 jugadores, deciden con equity", () => {
    const cases: [TableConfig, number][] = [
      [{ ...DEFAULT_CONFIG }, 6],
      [{ ...blinds, variants: [{ game: "omaha", deck: "long" }] }, 6],
      [{ ...blinds, variants: [{ game: "holdem", deck: "short" }] }, 6],
      [blinds, 7],
    ]
    for (const [config, n] of cases) {
      const t = startHand(createTable(config, names(n)), seededRng(4))
      expect(botDecide(t, seededRng(5), 50).source).toBe("equity")
    }
  })

  it("una mesa de bots con ciegas juega manos enteras sin errores", () => {
    const rng = seededRng(21)
    let t: TableState = createTable(blinds, names(6))
    let byRange = 0
    for (let hand = 0; hand < 30; hand++) {
      t.seats.forEach((_, i) => {
        if (botWantsCajita(t, i)) t = requestCajita(t, i)
      })
      t = startHand(t, rng)
      while (t.hand!.toAct !== null) {
        const r = botAct(t, rng, 40)
        if (r.decision.source === "pokerstrategy") byRange++
        t = r.table
      }
    }
    expect(byRange).toBeGreaterThan(30)
  }, 30000)
})
