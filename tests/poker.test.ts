import { describe, expect, it } from "vitest"
import { makeDeck, parseCards as P, seededRng, cardLabel } from "../lib/poker/cards"
import { bestHand, bestScore, Cat, categoryOf, eval5 } from "../lib/poker/evaluator"
import { computeEquity, countOuts, equityExact, equityMonteCarlo } from "../lib/poker/equity"
import { makeOuts, makePotOdds, makeWhoWins } from "../lib/poker/drills"
import type { Variant } from "../lib/poker/variants"
import type { DeckType } from "../lib/poker/cards"

const e5 = (s: string, deck: DeckType = "long") => {
  const c = P(s)
  return eval5(c[0], c[1], c[2], c[3], c[4], deck)
}
const cat = (s: string, deck: DeckType = "long") => categoryOf(e5(s, deck), deck)

const HE: Variant = { game: "holdem", deck: "long" }
const HE_SHORT: Variant = { game: "holdem", deck: "short" }
const OMAHA: Variant = { game: "omaha", deck: "long" }
const MANHATTAN: Variant = { game: "manhattan", deck: "long" }

describe("cartas", () => {
  it("mazo largo de 52 y corto de 36 sin 2-5", () => {
    expect(makeDeck("long")).toHaveLength(52)
    const short = makeDeck("short")
    expect(short).toHaveLength(36)
    expect(short.map(cardLabel).some((l) => /^[2-5]/.test(l))).toBe(false)
    expect(new Set(makeDeck("long")).size).toBe(52)
  })
})

describe("eval5 — categorías en mazo largo", () => {
  it.each([
    ["As Ks Qs Js Ts", Cat.StraightFlush],
    ["9h 9d 9s 9c 2d", Cat.Quads],
    ["Kh Kd Ks 4c 4d", Cat.FullHouse],
    ["Ah 9h 7h 4h 2h", Cat.Flush],
    ["9c 8d 7h 6s 5c", Cat.Straight],
    ["Ah 2d 3c 4s 5h", Cat.Straight],
    ["7h 7d 7s Kc 2d", Cat.Trips],
    ["Jh Jd 4s 4c Ad", Cat.TwoPair],
    ["Qh Qd 9s 4c 2d", Cat.Pair],
    ["Ah Jd 9s 4c 2d", Cat.HighCard],
  ])("%s", (hand, expected) => {
    expect(cat(hand)).toBe(expected)
  })

  it("orden de categorías: escalera de color > póker > full > color > escalera > trío > doble par > par > carta alta", () => {
    const hands = [
      "As Ks Qs Js Ts",
      "9h 9d 9s 9c 2d",
      "Kh Kd Ks 4c 4d",
      "Ah 9h 7h 4h 2h",
      "9c 8d 7h 6s 5c",
      "7h 7d 7s Kc 2d",
      "Jh Jd 4s 4c Ad",
      "Qh Qd 9s 4c 2d",
      "Ah Jd 9s 4c 2d",
    ].map((h) => e5(h))
    for (let i = 1; i < hands.length; i++) expect(hands[i - 1]).toBeGreaterThan(hands[i])
  })

  it("la escalera A-2-3-4-5 es la más baja", () => {
    expect(e5("6c 5d 4h 3s 2c")).toBeGreaterThan(e5("Ah 2d 3c 4s 5h"))
    // En mazo largo, A-6-7-8-9 no es escalera
    expect(cat("Ah 6d 7c 8s 9h")).toBe(Cat.HighCard)
  })

  it("kickers", () => {
    expect(e5("Ah Ad Ks 4c 2d")).toBeGreaterThan(e5("As Ac Qs Jc Td"))
    expect(e5("Kh Kd 9s 9c Ad")).toBeGreaterThan(e5("Ks Kc 9h 9d Qd"))
    expect(e5("Jh Jd 4s 4c Ad")).toBeGreaterThan(e5("Th Td 9s 9c Ad"))
    expect(e5("Ah Kd 9s 4c 3d")).toBeGreaterThan(e5("Ah Kd 9s 4c 2d"))
    expect(e5("2h 2d 2s Ac Ad")).toBeGreaterThan(e5("Ah Kd Qs Jc 9d") /* carta alta */)
    expect(e5("Ah Kd 9s 4c 3d")).toBe(e5("As Kc 9d 4h 3c"))
  })
})

describe("eval5 — mazo corto (reglas de la casa)", () => {
  it("el color le gana al full", () => {
    expect(e5("Ah 9h 8h 7h 6h".replace("6h", "Jh"), "short")).toBeGreaterThan(e5("Ah Ad As Kc Kd", "short"))
    expect(cat("Ah Jh 8h 7h 6h", "short")).toBe(Cat.Flush)
  })
  it("la escalera le gana al trío", () => {
    expect(e5("Tc 9d 8h 7s 6c", "short")).toBeGreaterThan(e5("Ah Ad As Kc Qd", "short"))
  })
  it("A-6-7-8-9 es escalera (la más baja)", () => {
    expect(cat("Ah 6d 7c 8s 9h", "short")).toBe(Cat.Straight)
    expect(e5("Tc 9d 8h 7s 6c", "short")).toBeGreaterThan(e5("Ah 6d 7c 8s 9h", "short"))
    expect(cat("Ah 6h 7h 8h 9h", "short")).toBe(Cat.StraightFlush)
  })
  it("el póker sigue arriba del color", () => {
    expect(e5("6h 6d 6s 6c 7d", "short")).toBeGreaterThan(e5("Ah Kh Qh Jh 9h", "short"))
  })
})

describe("mejor mano según el juego", () => {
  it("Hold'em: puede jugar la mesa", () => {
    const board = P("As Ks Qs Js Ts")
    expect(categoryOf(bestScore(P("2c 3d"), board, "holdem", "long"), "long")).toBe(Cat.StraightFlush)
  })

  it("Omaha: obligatorio 2 de la mano y 3 de la mesa", () => {
    // Una sola pica en la mano + 4 en la mesa: en Omaha NO hay color
    const hole = P("Ah Kd 7c 2s")
    const board = P("Qs Js 9s 4s 3h")
    expect(categoryOf(bestScore(hole, board, "holdem", "long"), "long")).toBe(Cat.Flush)
    expect(categoryOf(bestScore(hole, board, "omaha", "long"), "long")).not.toBe(Cat.Flush)
    // Cuatro cartas iguales en la mano no hacen póker: solo valen 2
    const quadsInHand = P("9h 9d 9s 9c")
    const b2 = P("Ah Kd 7c 4s 2h")
    expect(categoryOf(bestScore(quadsInHand, b2, "omaha", "long"), "long")).toBe(Cat.Pair)
  })

  it("Manhattan: 2 o 3 de la mano", () => {
    // Trío en la mano + par en la mesa = full (3 + 2)
    const hole = P("8h 8d 8s Kc 2d")
    const board = P("Jh Jd 4c 6s 9h")
    expect(categoryOf(bestScore(hole, board, "manhattan", "long"), "long")).toBe(Cat.FullHouse)
    // Con 4 del mismo palo en la mano y 1 en la mesa no hay color (máx. 3 propias)
    const h2 = P("Ah Kh Qh Jh 2c")
    const b2 = P("3h 9d 7c 5s 4d")
    expect(categoryOf(bestScore(h2, b2, "manhattan", "long"), "long")).not.toBe(Cat.Flush)
    // Pero sí hace escalera A-2-3-4-5 con 2 propias (A, 2) + 3 de la mesa (3, 4, 5)
    expect(categoryOf(bestScore(h2, b2, "manhattan", "long"), "long")).toBe(Cat.Straight)
  })

  it("bestHand nombra la mano y marca las cartas propias", () => {
    const h = bestHand(P("Kh Kd"), P("Ks 4c 4d 9h 2s"), "holdem", "long")!
    expect(h.name).toBe("Full de K con 4")
    expect(h.fromHole).toHaveLength(2)
    expect(h.cards.map(cardLabel)).toEqual(["K♥", "K♦", "K♠", "4♣", "4♦"])
  })
})

describe("equity", () => {
  it("AA contra KK antes del flop ≈ 82%", () => {
    const r = equityMonteCarlo([P("As Ah"), P("Ks Kh")], [], HE, 40000, seededRng(1))
    expect(r.equity[0]).toBeGreaterThan(0.8)
    expect(r.equity[0]).toBeLessThan(0.84)
  })

  it("proyecto de color en el turn: 9 outs de 44", () => {
    // Héroe con A♠K♠, mesa con dos picas; rival con par de reinas
    const hero = P("As Ks")
    const villain = P("Qd Qc")
    const board = P("7s 2s 9h 4d")
    const o = countOuts(hero, villain, board, HE)
    // 9 picas + 3 ases + 3 reyes que no son pica = 15 (los A/K dan par mayor)
    expect(o.unseen).toBe(44)
    expect(o.outs).toHaveLength(15)
    const eq = equityExact([hero, villain], board, HE)
    expect(eq.equity[0]).toBeCloseTo(15 / 44, 10)
  })

  it("la equity suma 1 y elige cuenta exacta cuando puede", () => {
    const r = computeEquity([P("Ah Kh"), P("Qs Qd"), P("7c 8c")], P("Qh Jh 2c"), HE)
    expect(r.exact).toBe(true)
    expect(r.equity.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
  })

  it("mazo corto: los outs se cuentan sobre 36 cartas", () => {
    const o = countOuts(P("As Ks"), P("Qd Qc"), P("7s 6s 9h"), HE_SHORT)
    expect(o.unseen).toBe(36 - 7)
  })

  it("Omaha y Manhattan: equity exacta en el turn", () => {
    const om = equityExact([P("Ah Kh Qd Jd"), P("9s 9c 8s 7c")], P("Th 9h 2d 3c"), OMAHA)
    expect(om.equity[0] + om.equity[1]).toBeCloseTo(1, 10)
    const mh = equityExact([P("Ah Kh Qd Jd 2c"), P("9s 9c 8s 7c 7d")], P("Th 9h 2d 3c"), MANHATTAN)
    expect(mh.samples).toBe(52 - 14)
  })
})

describe("ejercicios", () => {
  const variants: Variant[] = [
    { game: "holdem", deck: "long" },
    { game: "holdem", deck: "short" },
    { game: "omaha", deck: "long" },
    { game: "omaha", deck: "short" },
    { game: "manhattan", deck: "long" },
    { game: "manhattan", deck: "short" },
  ]

  it.each(variants)("$game $deck: generan situaciones coherentes", (v) => {
    const rng = seededRng(42)
    for (let i = 0; i < 5; i++) {
      const w = makeWhoWins(v, rng)
      expect(w.winners.length).toBeGreaterThan(0)
      const top = Math.max(...w.hands.map((h) => h.score))
      for (const i2 of w.winners) expect(w.hands[i2].score).toBe(top)

      const o = makeOuts(v, rng)
      expect(o.outs.length).toBeGreaterThan(0)
      expect(o.options).toContain(o.outs.length)
      expect(new Set(o.options).size).toBe(4)
      expect(o.heroHand.score).toBeLessThan(o.villainHand.score)

      const p = makePotOdds(v, rng)
      expect(p.needed).toBeGreaterThan(0)
      expect(p.needed).toBeLessThan(0.5)
      expect(p.shouldCall).toBe(p.equity >= p.needed)
    }
  })
})

describe("eval5 — todas las manos de 5 cartas", () => {
  it("mazo largo: frecuencias conocidas y 7462 manos distintas", () => {
    const deck = makeDeck("long")
    const byCat = new Array(9).fill(0)
    const distinct = new Set<number>()
    for (let a = 0; a < 52; a++)
      for (let b = a + 1; b < 52; b++)
        for (let c = b + 1; c < 52; c++)
          for (let d = c + 1; d < 52; d++)
            for (let e = d + 1; e < 52; e++) {
              const s = eval5(deck[a], deck[b], deck[c], deck[d], deck[e], "long")
              byCat[categoryOf(s, "long")]++
              distinct.add(s)
            }
    expect(byCat).toEqual([1302540, 1098240, 123552, 54912, 10200, 5108, 3744, 624, 40])
    expect(distinct.size).toBe(7462)
  })
})

describe("tabla de jugadas", () => {
  it("cada ejemplo es de su categoría", async () => {
    const { HAND_EXAMPLES } = await import("../lib/poker/examples")
    for (const deck of ["long", "short"] as const) {
      for (const [catKey, hand] of Object.entries(HAND_EXAMPLES[deck])) {
        expect(cat(hand, deck)).toBe(Number(catKey))
        if (deck === "short") expect(P(hand).every((c) => (c >> 2) + 2 >= 6)).toBe(true)
      }
    }
  })
})

describe("¿Qué tenés?", () => {
  it.each([
    { game: "holdem", deck: "long" },
    { game: "omaha", deck: "long" },
    { game: "omaha", deck: "short" },
    { game: "manhattan", deck: "long" },
    { game: "manhattan", deck: "short" },
  ] as Variant[])("$game $deck: la respuesta es la mano válida y la trampa es mejor pero ilegal", async (v) => {
    const { makeUsable } = await import("../lib/poker/drills")
    const rng = seededRng(7)
    let traps = 0
    for (let i = 0; i < 40; i++) {
      const d = makeUsable(v, rng)
      expect(d.hand.score).toBe(bestScore(d.hole, d.board, v.game, v.deck))
      expect(d.options).toContain(d.hand.cat)
      expect(new Set(d.options).size).toBe(4)
      if (d.trap) {
        traps++
        expect(d.trap.score).toBeGreaterThan(d.hand.score)
        expect(d.options).toContain(d.trap.cat)
        const own = d.trap.cards.filter((c) => d.hole.includes(c)).length
        const allowed = v.game === "omaha" ? [2] : v.game === "manhattan" ? [2, 3] : [0, 1, 2]
        expect(allowed).not.toContain(own)
      }
    }
    if (v.game === "holdem") expect(traps).toBe(0)
    else expect(traps).toBeGreaterThan(20)
  })
})

describe("progreso y Desafío del día", () => {
  it("racha de días: cuenta hasta hoy o hasta ayer", async () => {
    const { dayStreak, addDays } = await import("../lib/poker/training")
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28")
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01")
    expect(dayStreak(["2026-11-23", "2026-11-22", "2026-11-20"], "2026-11-23")).toBe(2)
    expect(dayStreak(["2026-11-22", "2026-11-21"], "2026-11-23")).toBe(2) // hoy todavía no jugó
    expect(dayStreak(["2026-11-20"], "2026-11-23")).toBe(0)
    expect(dayStreak([], "2026-11-23")).toBe(0)
  })

  it("el desafío es igual para todos el mismo día y cambia de un día a otro", async () => {
    const { dailyChallenge, DAILY_LENGTH } = await import("../lib/poker/training")
    const a = dailyChallenge("2026-11-23")
    const b = dailyChallenge("2026-11-23")
    expect(a).toHaveLength(DAILY_LENGTH)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(JSON.stringify(dailyChallenge("2026-11-24"))).not.toBe(JSON.stringify(a))
  })
})

describe("rangos de apertura (PokerStrategy 6-max)", () => {
  it("cada rango suma exactamente las combinaciones que publica la fuente", async () => {
    const { OPEN_RANGES, parseRange, comboCount } = await import("../lib/poker/preflop")
    for (const r of Object.values(OPEN_RANGES)) {
      const total = [...parseRange(r.range)].reduce((a, h) => a + comboCount(h), 0)
      expect(total, r.pos).toBe(r.combos)
    }
  })

  it("parser y clases de mano", async () => {
    const { parseRange, handClass, gridClasses, openRange } = await import("../lib/poker/preflop")
    expect([...parseRange("QQ+")].sort()).toEqual(["AA", "KK", "QQ"])
    expect([...parseRange("A2s-A4s")].sort()).toEqual(["A2s", "A3s", "A4s"])
    expect([...parseRange("KQ")].sort()).toEqual(["KQo", "KQs"])
    expect(handClass(P("Ks")[0], P("Ah")[0])).toBe("AKo")
    expect(handClass(P("2c")[0], P("7c")[0])).toBe("72s")
    expect(gridClasses().flat()).toHaveLength(169)
    expect(new Set(gridClasses().flat()).size).toBe(169)
    // Ejemplos leídos en la fuente
    expect(openRange("UTG").has("ATo")).toBe(false)
    expect(openRange("UTG").has("44")).toBe(false)
    expect(openRange("BU").has("72o")).toBe(false)
    expect(openRange("BU").has("K5o")).toBe(true)
    expect(openRange("SB").has("55")).toBe(false)
  })

  it("el ejercicio respeta la mesa y la respuesta sale del rango", async () => {
    const { makePreflop } = await import("../lib/poker/drills")
    const { POSITIONS_BY_TABLE, openRange } = await import("../lib/poker/preflop")
    const rng = seededRng(3)
    let opens = 0
    for (let i = 0; i < 300; i++) {
      const d = makePreflop(HE, rng, 4)
      expect(POSITIONS_BY_TABLE[4]).toContain(d.pos)
      expect(d.cards[0]).not.toBe(d.cards[1])
      expect(d.open).toBe(openRange(d.pos).has(d.hand!))
      if (d.open) opens++
    }
    expect(opens).toBeGreaterThan(60)
    expect(opens).toBeLessThan(240)
  })
})

describe("¿Cuál es mejor?", () => {
  it.each([HE, HE_SHORT, OMAHA, MANHATTAN])("$game $deck: la mejor es la de más equity y la diferencia es clara", async (v) => {
    const { makeCompare, COMPARE_MIN_GAP } = await import("../lib/poker/drills")
    const rng = seededRng(11)
    for (let i = 0; i < 3; i++) {
      const d = makeCompare(v, rng)
      expect(d.equity[d.better]).toBeGreaterThanOrEqual(d.equity[1 - d.better])
      expect(d.equity[0] + d.equity[1]).toBeCloseTo(1, 6)
      expect(Math.abs(d.equity[0] - d.equity[1])).toBeGreaterThanOrEqual(COMPARE_MIN_GAP)
    }
  }, 60000)

  it("rasgos de la mano", async () => {
    const { handTraits } = await import("../lib/poker/drills")
    expect(handTraits(P("As Ks Qd Jd"))).toEqual(["dos palos", "4 seguidas", "4 cartas altas"])
    expect(handTraits(P("9h 9c 4s 2d"))).toEqual(["sin palo repetido", "par de 9", "ninguna alta (10 o más)"])
    expect(handTraits(P("Ah 2h 3h 4h"))).toEqual(["todas del mismo palo", "4 seguidas", "1 carta alta"])
    expect(handTraits(P("Kd Qd"))).toEqual(["mismo palo", "2 seguidas", "2 cartas altas"])
  })
})

describe("¿Abrís? Beta", () => {
  it("datos generados completos y coherentes", async () => {
    const { BETA_DATA } = await import("../lib/poker/preflop-beta-data")
    const { gridClasses } = await import("../lib/poker/preflop")
    expect(Object.keys(BETA_DATA.shortGrid).sort()).toEqual(gridClasses("short").flat().sort())
    for (const key of ["holdem:short", "omaha:long", "omaha:short", "manhattan:long", "manhattan:short"]) {
      const t = BETA_DATA.thresholds[key]
      // Se abre más cuanto más tarde: UTG 13% < MP 17% < SB 31% < CO 32% < BU 62%.
      expect(t.UTG, key).toBeGreaterThanOrEqual(t.MP)
      expect(t.MP, key).toBeGreaterThanOrEqual(t.SB)
      expect(t.SB, key).toBeGreaterThanOrEqual(t.CO)
      expect(t.CO, key).toBeGreaterThanOrEqual(t.BU)
    }
    for (const x of Object.values(BETA_DATA.validation)) expect(x).toBeGreaterThan(0.8)
  })

  it("Hold'em short: AA abre siempre y las peores no abren ni en el botón", async () => {
    const { shortOpens } = await import("../lib/poker/preflop-beta")
    for (const pos of ["UTG", "MP", "CO", "BU", "SB"] as const) expect(shortOpens("AA", pos)).toBe(true)
    expect(shortOpens("76o", "UTG")).toBe(false)
    expect(shortOpens("76o", "BU") && shortOpens("86o", "BU") && shortOpens("96o", "BU")).toBe(false)
  })

  it.each([OMAHA, MANHATTAN, HE_SHORT])("$game $deck: la respuesta sale de la regla Beta", async (v) => {
    const { makePreflop } = await import("../lib/poker/drills")
    const { shortOpens } = await import("../lib/poker/preflop-beta")
    const rng = seededRng(5)
    for (let i = 0; i < 4; i++) {
      const d = makePreflop(v, rng, 6)
      expect(d.beta).toBe(true)
      if (v.game === "holdem") expect(d.open).toBe(shortOpens(d.hand!, d.pos))
      else expect(d.open).toBe(d.equity! >= d.threshold!)
    }
  }, 60000)
})

describe("Con luz", () => {
  it.each([HE, HE_SHORT, OMAHA, MANHATTAN])("$game $deck: pozo, orden y cuentas", async (v) => {
    const { makeLuz } = await import("../lib/poker/drills")
    const rng = seededRng(21)
    let withBet = 0
    for (let i = 0; i < 6; i++) {
      const d = makeLuz(v, rng)
      expect(d.players).toBeGreaterThanOrEqual(4)
      expect(d.players).toBeLessThanOrEqual(6)
      expect(d.luz).toBe(100)
      expect(d.pot).toBe(d.players * d.luz)
      expect(d.seat).toBeGreaterThanOrEqual(1)
      expect(d.seat).toBeLessThanOrEqual(d.players)
      if (d.bet) {
        withBet++
        expect(d.bet.seat).toBeLessThan(d.seat) // apostó alguien que habla antes
        expect(d.bet.needed).toBeCloseTo(d.bet.amount / (d.pot + 2 * d.bet.amount), 10)
        expect(d.bet.shouldCall).toBe(d.bet.equity >= d.bet.needed)
        expect(new Set([...d.hero, ...d.bet.villain]).size).toBe(d.hero.length * 2)
      }
    }
    expect(withBet).toBeGreaterThan(0)
  }, 60000)
})
