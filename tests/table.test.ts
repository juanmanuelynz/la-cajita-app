import { describe, expect, it } from "vitest"
import { parseCards, seededRng } from "../lib/poker/cards"
import {
  act,
  buildPots,
  canRequestCajita,
  chipsOf,
  createTable,
  DEFAULT_CONFIG,
  legalActions,
  maxSeats,
  netResult,
  potTotal,
  requestCajita,
  startHand,
  variantForHand,
  winningCards,
  type TableConfig,
  type TableState,
} from "../lib/poker/table"

const names = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `J${i}` }))
const cfg = (over: Partial<TableConfig> = {}): TableConfig => ({ ...DEFAULT_CONFIG, ...over })

/** Mesa con stacks a medida (antes de la primera mano). */
function table(stacks: number[], over: Partial<TableConfig> = {}): TableState {
  const t = createTable(cfg(over), names(stacks.length))
  stacks.forEach((s, i) => (t.seats[i].stack = s))
  return t
}

const holes = (...hs: string[]) => Object.fromEntries(hs.map((h, i) => [i, parseCards(h)]))
const totalChips = (t: TableState) => t.seats.reduce((s, _, i) => s + chipsOf(t, i), 0)

describe("Motor de la mano: arranque", () => {
  it("cada uno arranca con una cajita, pone la luz y habla primero el de la izquierda del que reparte", () => {
    let t = createTable(cfg(), names(3))
    expect(t.seats.map((s) => s.stack)).toEqual([2000, 2000, 2000])
    t = startHand(t, seededRng(1))
    const h = t.hand!
    expect(h.button).toBe(0)
    expect(h.players.map((p) => p.seat)).toEqual([1, 2, 0]) // el que reparte, último
    expect(h.toAct).toBe(1)
    expect(potTotal(h)).toBe(300)
    expect(t.seats.map((s) => s.stack)).toEqual([1900, 1900, 1900])
    expect(h.players.every((p) => p.hole.length === 2)).toBe(true)
    // La luz no es apuesta: se puede pasar antes del flop.
    expect(legalActions(t)!.canCheck).toBe(true)
  })

  it("el botón rota y saltea a los que no tienen fichas", () => {
    let t = table([2000, 0, 2000, 2000])
    t = startHand(t, seededRng(2))
    expect(t.hand!.button).toBe(0)
    expect(t.hand!.players.map((p) => p.seat)).toEqual([2, 3, 0])
    t.hand!.result = { showdown: false, pots: [], won: {}, handNames: {} }
    t = startHand(t, seededRng(3))
    expect(t.hand!.button).toBe(2)
  })

  it("máximo de jugadores por juego y mazo", () => {
    expect(maxSeats({ game: "holdem", deck: "long" })).toBe(8)
    expect(maxSeats({ game: "holdem", deck: "short" })).toBe(8)
    expect(maxSeats({ game: "omaha", deck: "short" })).toBe(7)
    expect(maxSeats({ game: "manhattan", deck: "short" })).toBe(6)
    expect(maxSeats({ game: "manhattan", deck: "short" }, true)).toBe(5)
    expect(maxSeats({ game: "manhattan", deck: "long" })).toBe(8)
    expect(() => createTable(cfg({ variants: [{ game: "manhattan", deck: "short" }] }), names(7))).toThrow()
    // En rotación manda el más justo.
    expect(() =>
      createTable(cfg({ variants: [{ game: "holdem", deck: "short" }, { game: "omaha", deck: "short" }] }), names(8)),
    ).toThrow()
  })

  it("luz y cajita en múltiplos de la ficha", () => {
    expect(() => createTable(cfg({ luz: 150 }), names(3))).toThrow()
    expect(() => createTable(cfg({ cajita: 2050 }), names(3))).toThrow()
    expect(() => createTable(cfg({ luz: 200, cajita: 5000 }), names(3))).not.toThrow()
  })

  it("en rotación cambia de juego cada vuelta completa de la mesa", () => {
    const t = createTable(cfg({ variants: [{ game: "holdem", deck: "long" }, { game: "omaha", deck: "long" }] }), names(3))
    expect([1, 2, 3, 4, 5, 6, 7].map((n) => variantForHand(t, n).game)).toEqual([
      "holdem", "holdem", "holdem", "omaha", "omaha", "omaha", "holdem",
    ])
  })

  it("reparte la cantidad de cartas de cada juego y la mesa sale de a 3, 1 y 1", () => {
    let t = createTable(cfg({ variants: [{ game: "manhattan", deck: "short" }] }), names(6))
    t = startHand(t, seededRng(4))
    expect(t.hand!.players.every((p) => p.hole.length === 5)).toBe(true)
    const all = [...t.hand!.players.flatMap((p) => p.hole), ...t.hand!.deck]
    expect(new Set(all).size).toBe(36)
    for (let i = 0; i < 6; i++) t = act(t, { type: "check" })
    expect(t.hand!.street).toBe("flop")
    expect(t.hand!.board).toHaveLength(3)
    for (let i = 0; i < 6; i++) t = act(t, { type: "check" })
    expect(t.hand!.board).toHaveLength(4)
  })
})

describe("Motor de la mano: apuestas", () => {
  it("todos pasan hasta el final: gana la mejor mano", () => {
    let t = table([2000, 2000, 2000])
    t = startHand(t, seededRng(1), { holes: holes("As Ad", "Ks Kd", "7c 2h"), board: parseCards("9s 8d 4c 3h Jc") })
    for (let i = 0; i < 12; i++) t = act(t, { type: "check" })
    const r = t.hand!.result!
    expect(r.showdown).toBe(true)
    expect(r.won).toEqual({ 0: 300 })
    expect(t.seats.map((s) => s.stack)).toEqual([2200, 1900, 1900])
    expect(r.handNames[0]).toBeTruthy()
  })

  it("si se retiran todos, el que apostó se lleva el pozo sin mostrar", () => {
    let t = table([2000, 2000, 2000])
    t = startHand(t, seededRng(1))
    t = act(t, { type: "raise", to: 200 }) // asiento 1
    t = act(t, { type: "fold" }) // 2
    t = act(t, { type: "fold" }) // 0
    const r = t.hand!.result!
    expect(r.showdown).toBe(false)
    expect(t.seats[1].stack).toBe(2000 - 100 - 200 + 500)
    expect(t.hand!.board).toHaveLength(0)
  })

  it("apuesta mínima = la luz; subida mínima = la última subida", () => {
    let t = table([5000, 5000, 5000])
    t = startHand(t, seededRng(1))
    expect(legalActions(t)!.minTo).toBe(100)
    expect(() => act(t, { type: "raise", to: 50 })).toThrow()
    t = act(t, { type: "raise", to: 300 }) // 1 apuesta 300
    expect(legalActions(t)!.minTo).toBe(600)
    expect(() => act(t, { type: "raise", to: 500 })).toThrow()
    expect(() => act(t, { type: "raise", to: 650 })).toThrow() // de a $100
    t = act(t, { type: "raise", to: 1000 }) // 2 sube 700
    expect(legalActions(t)!.minTo).toBe(1700)
    expect(legalActions(t)!.toCall).toBe(1000)
    expect(() => act(t, { type: "check" })).toThrow()
  })

  it("un all-in corto no le reabre la subida a quien ya habló", () => {
    // Asiento 2 tiene 600: después de la luz le quedan 500.
    let t = table([5000, 5000, 600])
    t = startHand(t, seededRng(1))
    t = act(t, { type: "raise", to: 400 }) // 1 apuesta 400
    t = act(t, { type: "raise", to: 500 }) // 2 all-in por 500: sube solo 100 (< 400)
    // 0 todavía no habló: puede subir.
    let l = legalActions(t)!
    expect(l.seat).toBe(0)
    expect(l.canRaise).toBe(true)
    expect(l.minTo).toBe(900) // 500 + la última subida completa (400)
    t = act(t, { type: "call" })
    // 1 ya habló y solo le subieron 100: paga o se va, pero no sube.
    l = legalActions(t)!
    expect(l.seat).toBe(1)
    expect(l.canRaise).toBe(false)
    expect(l.toCall).toBe(100)
  })

  it("con un all-in sin nadie más que pueda pagar, no se puede subir", () => {
    let t = table([5000, 1100])
    t = startHand(t, seededRng(1))
    // Mano a mano: habla primero el 1 (izquierda del botón 0).
    t = act(t, { type: "raise", to: 1000 }) // 1 all-in
    const l = legalActions(t)!
    expect(l.canRaise).toBe(false)
    expect(l.toCall).toBe(1000)
  })
})

describe("Motor de la mano: con ciegas", () => {
  const blinds = { structure: "ciegas" as const }

  it("la chica y la grande las ponen los dos de la izquierda del botón; habla primero el de la izquierda de la grande", () => {
    let t = table([2000, 2000, 2000, 2000], blinds)
    t = startHand(t, seededRng(1))
    const h = t.hand!
    expect(h.button).toBe(0)
    expect(t.seats.map((s) => s.stack)).toEqual([2000, 1900, 1800, 2000])
    expect(potTotal(h)).toBe(300)
    expect(h.toAct).toBe(3)
    const l = legalActions(t)!
    expect(l.canCheck).toBe(false)
    expect(l.toCall).toBe(200)
    expect(l.minTo).toBe(400) // grande + otra grande
  })

  it("si todos pagan, la grande puede pasar o subir; después del flop habla primero la chica", () => {
    let t = table([2000, 2000, 2000], blinds)
    t = startHand(t, seededRng(1))
    t = act(t, { type: "call" }) // 0 (botón)
    t = act(t, { type: "call" }) // 1 (chica) completa
    const l = legalActions(t)!
    expect(l.seat).toBe(2)
    expect(l.canCheck).toBe(true)
    expect(l.canRaise).toBe(true)
    t = act(t, { type: "check" })
    expect(t.hand!.street).toBe("flop")
    expect(t.hand!.toAct).toBe(1)
    expect(legalActions(t)!.minTo).toBe(200) // apuesta mínima: la grande
  })

  it("si la grande sube, vuelven a hablar los demás", () => {
    let t = table([2000, 2000, 2000], blinds)
    t = startHand(t, seededRng(1))
    t = act(t, { type: "call" })
    t = act(t, { type: "call" })
    t = act(t, { type: "raise", to: 600 })
    expect(t.hand!.toAct).toBe(0)
    expect(legalActions(t)!.toCall).toBe(400)
  })

  it("mano a mano: el que reparte pone la chica y habla primero antes del flop, último después", () => {
    let t = table([2000, 2000], blinds)
    t = startHand(t, seededRng(1))
    expect(t.seats.map((s) => s.stack)).toEqual([1900, 1800])
    expect(t.hand!.toAct).toBe(0)
    t = act(t, { type: "call" })
    t = act(t, { type: "check" })
    expect(t.hand!.street).toBe("flop")
    expect(t.hand!.toAct).toBe(1)
  })

  it("si se retiran todos ante la grande, se lleva las ciegas", () => {
    let t = table([2000, 2000, 2000], blinds)
    t = startHand(t, seededRng(1))
    t = act(t, { type: "fold" })
    t = act(t, { type: "fold" })
    expect(t.hand!.result!.won).toEqual({ 2: 300 })
    expect(t.seats.map((s) => s.stack)).toEqual([2000, 1900, 2100])
  })

  it("ciegas en múltiplos de la ficha y la grande no menor que la chica", () => {
    expect(() => createTable(cfg({ ...blinds, blinds: { small: 50, big: 100 } }), names(3))).toThrow()
    expect(() => createTable(cfg({ ...blinds, blinds: { small: 300, big: 200 } }), names(3))).toThrow()
    expect(() => createTable(cfg({ ...blinds, blinds: { small: 100, big: 100 } }), names(3))).not.toThrow()
  })
})

describe("Motor de la mano: pozos", () => {
  it("tres all-in de distinto tamaño arman pozo principal y dos laterales", () => {
    // Stacks antes de la luz: 500, 1000, 2000, 2000. Manos: 0 > 1 > 2 > 3.
    let t = table([2000, 500, 1000, 2000])
    // Botón 0 → hablan 1, 2, 3, 0. Reordeno para que el asiento 1 tenga la mejor.
    t = startHand(t, seededRng(1), {
      holes: holes("7c 2d", "As Ad", "Ks Kd", "Qs Qd"),
      board: parseCards("9s 8d 4c 3h Jc"),
    })
    t = act(t, { type: "raise", to: 400 }) // 1 all-in (500 con la luz)
    t = act(t, { type: "raise", to: 900 }) // 2 all-in (1000)
    t = act(t, { type: "raise", to: 1900 }) // 3 all-in (2000)
    t = act(t, { type: "call" }) // 0 paga todo (2000)
    const r = t.hand!.result!
    expect(t.hand!.board).toHaveLength(5)
    expect(r.pots.map((p) => p.amount)).toEqual([2000, 1500, 2000])
    expect(r.pots.map((p) => p.winners)).toEqual([[1], [2], [3]])
    expect(r.won).toEqual({ 1: 2000, 2: 1500, 3: 2000 })
    expect(t.seats.map((s) => s.stack)).toEqual([0, 2000, 1500, 2000])
  })

  it("lo que nadie pagó vuelve al que lo apostó", () => {
    let t = table([3000, 500])
    t = startHand(t, seededRng(1), { holes: holes("7c 2d", "As Ad"), board: parseCards("9s 8d 4c 3h Jc") })
    t = act(t, { type: "check" }) // 1
    t = act(t, { type: "raise", to: 1500 }) // 0
    t = act(t, { type: "call" }) // 1 all-in por 400
    const r = t.hand!.result!
    expect(r.won).toEqual({ 1: 1000, 0: 1100 })
    expect(t.seats.map((s) => s.stack)).toEqual([2500, 1000])
  })

  it("empate: se reparte de a fichas y la que sobra va al primero desde la izquierda del botón", () => {
    let t = table([2000, 2000, 2000])
    // Escalera en la mesa: empatan 1 y 2; el 0 se retira. Pozo 300 → 150 c/u no se divide de a $100.
    t = startHand(t, seededRng(1), {
      holes: holes("2c 3d", "2s 3h", "2h 3c"),
      board: parseCards("As Kd Qc Jh Ts"),
    })
    t = act(t, { type: "check" }) // 1
    t = act(t, { type: "check" }) // 2
    t = act(t, { type: "fold" }) // 0
    for (let i = 0; i < 6; i++) t = act(t, { type: "check" })
    const r = t.hand!.result!
    expect(r.pots[0].winners).toEqual([1, 2])
    expect(r.won).toEqual({ 1: 200, 2: 100 })
  })

  it("buildPots junta niveles con los mismos candidatos", () => {
    const base = { hole: [], allIn: false, streetBet: 0, acted: true, canRaise: false }
    const pots = buildPots([
      { ...base, seat: 0, folded: false, committed: 300 },
      { ...base, seat: 1, folded: true, committed: 100 },
      { ...base, seat: 2, folded: false, committed: 300 },
    ])
    expect(pots).toEqual([{ amount: 700, eligible: [0, 2] }])
  })

  it("Short deck: el color le gana al full", () => {
    let t = table([2000, 2000], { variants: [{ game: "holdem", deck: "short" }] })
    t = startHand(t, seededRng(1), {
      holes: holes("Ks Kd", "As 7s"),
      board: parseCards("Kh 9s 9d 8s 6s"),
    })
    for (let i = 0; i < 8; i++) t = act(t, { type: "check" })
    expect(t.hand!.result!.won).toEqual({ 1: 200 })
  })
})

describe("Motor de la mano: cajitas", () => {
  it("se pide otra con un cuarto de la cajita o menos y entra en la mano siguiente", () => {
    expect(canRequestCajita(table([600, 2000]), 0)).toBe(false) // 600 > 500
    let t = table([500, 2000])
    expect(canRequestCajita(t, 0)).toBe(true)
    t = requestCajita(t, 0)
    expect(canRequestCajita(t, 0)).toBe(false) // ya pidió
    expect(t.seats[0].stack).toBe(500)
    t = startHand(t, seededRng(1))
    expect(t.seats[0].cajitas).toBe(2)
    expect(chipsOf(t, 0)).toBe(2500)
    expect(netResult(t, 0)).toBe(2500 - 4000)
  })

  it("las fichas no se crean ni se pierden en cientos de manos al azar", () => {
    const rng = seededRng(99)
    for (const [variant, structure] of [
      [{ game: "holdem", deck: "long" }, "luz"],
      [{ game: "omaha", deck: "short" }, "luz"],
      [{ game: "manhattan", deck: "short" }, "luz"],
      [{ game: "holdem", deck: "long" }, "ciegas"],
      [{ game: "manhattan", deck: "short" }, "ciegas"],
    ] as const) {
      let t = createTable(cfg({ variants: [variant], structure }), names(variant.game === "manhattan" ? 6 : 5))
      for (let hand = 0; hand < 120; hand++) {
        // Al que le queda poco, le entra otra cajita.
        t.seats.forEach((_, i) => {
          if (canRequestCajita(t, i) && rng() < 0.7) t = requestCajita(t, i)
        })
        if (t.seats.filter((s) => s.stack + s.pending * t.config.cajita > 0).length < 2) break
        t = startHand(t, rng)
        const expected = t.seats.reduce((s, x) => s + x.cajitas * t.config.cajita, 0)
        let steps = 0
        while (t.hand!.toAct !== null) {
          const l = legalActions(t)!
          const r = rng()
          if (l.canRaise && r < 0.25) {
            const span = Math.floor((l.maxTo - l.minTo) / 100)
            const to = r < 0.05 ? l.maxTo : l.minTo + 100 * Math.floor(rng() * (span + 1))
            t = act(t, { type: "raise", to })
          } else if (l.canCheck) t = act(t, { type: "check" })
          else if (r < 0.8) t = act(t, { type: "call" })
          else t = act(t, { type: "fold" })
          expect(++steps).toBeLessThan(200)
        }
        const h = t.hand!
        expect(h.result).not.toBeNull()
        expect(totalChips(t)).toBe(expected)
        expect(t.seats.every((s) => s.stack >= 0)).toBe(true)
        const paid = Object.values(h.result!.won).reduce((a, b) => a + b, 0)
        expect(paid).toBe(h.players.reduce((s, p) => s + p.committed, 0))
        if (h.result!.showdown) expect(h.board).toHaveLength(5)
      }
    }
  })
})

describe("winningCards", () => {
  type Hand = Parameters<typeof winningCards>[0]
  const hand = (over: Partial<Hand>): Hand =>
    ({
      variant: { game: "omaha", deck: "short" },
      board: parseCards("9h Ks 6s Jc 7h"),
      players: [
        { seat: 0, hole: parseCards("As 8h 7s 8s"), folded: false },
        { seat: 1, hole: parseCards("Kc Kh Td Th"), folded: false },
      ],
      result: {
        showdown: true,
        pots: [{ amount: 5000, eligible: [0, 1], winners: [0] }],
        won: { 0: 5000 },
        handNames: {},
      },
      ...over,
    }) as unknown as Hand

  it("marca las 2 propias y las 3 de la mesa que arman la escalera A-6-7-8-9 en Omaha short", () => {
    const w = winningCards(hand({}))!
    expect(w.hole[0]).toHaveLength(2)
    expect(w.hole[0]).toContain(parseCards("As")[0])
    expect(w.hole[0].some((c) => parseCards("8h 8s").includes(c))).toBe(true)
    expect(w.hole[1]).toBeUndefined()
    expect(w.board).toEqual(parseCards("9h 6s 7h"))
  })

  it("sin showdown no marca nada; un pozo que se devuelve no cuenta como ganado", () => {
    const h = hand({})
    expect(winningCards({ ...h, result: { ...h.result!, showdown: false } })).toBeNull()
    const back = winningCards({
      ...h,
      result: { ...h.result!, pots: [...h.result!.pots, { amount: 300, eligible: [1], winners: [1] }] },
    })!
    expect(Object.keys(back.hole)).toEqual(["0"])
  })
})

describe("reglas de la casa con luz (confirmadas el 28/11/2026)", () => {
  const luzTable = (n: number) => table(Array(n).fill(10000), { structure: "luz", luz: 100 })
  const order = (t: TableState) => t.hand!.players.map((p) => p.seat)

  it("los que no entran no ponen luz ni reciben cartas, y habla primero la mano", () => {
    let t = luzTable(4)
    t = startHand(t, seededRng(3), undefined, [2])
    const h = t.hand!
    expect(h.button).toBe(0)
    expect(order(t)).toEqual([1, 3, 0])
    expect(t.seats[2].stack).toBe(10000)
    expect(h.players.every((p) => p.committed === 100)).toBe(true)
    expect(h.toAct).toBe(1)
    expect(() => startHand(luzTable(3), seededRng(1), undefined, [1, 2])).toThrow()
  })

  it("con ciegas no se puede dejar de entrar", () => {
    const t = startHand(table([10000, 10000, 10000], { structure: "ciegas" }), seededRng(3), undefined, [2])
    expect(order(t)).toContain(2)
  })

  it("el último que apostó habla primero en las calles siguientes, hasta que otro apueste", () => {
    let t = startHand(luzTable(4), seededRng(5))
    // Orden: 1, 2, 3, 0. Antes del flop apuesta el 3; pagan todos.
    t = act(t, { type: "check" }) // 1
    t = act(t, { type: "check" }) // 2
    t = act(t, { type: "raise", to: 300 }) // 3
    t = act(t, { type: "call" }) // 0
    t = act(t, { type: "call" }) // 1
    t = act(t, { type: "call" }) // 2
    expect(t.hand!.street).toBe("flop")
    expect(t.hand!.toAct).toBe(3)
    // En el flop pasan todos: en el turn sigue hablando primero el 3.
    for (let i = 0; i < 4; i++) t = act(t, { type: "check" })
    expect(t.hand!.street).toBe("turn")
    expect(t.hand!.toAct).toBe(3)
    // En el turn apuesta el 1 (después de que pasan 3 y 0): en el river habla primero el 1.
    t = act(t, { type: "check" }) // 3
    t = act(t, { type: "check" }) // 0
    t = act(t, { type: "raise", to: 500 }) // 1
    t = act(t, { type: "call" }) // 2
    t = act(t, { type: "fold" }) // 3
    t = act(t, { type: "call" }) // 0
    expect(t.hand!.street).toBe("river")
    expect(t.hand!.toAct).toBe(1)
  })

  it("si el que apostó quedó all-in, habla primero el siguiente a su izquierda", () => {
    // El 2 tiene poco: apuesta todo antes del flop (después de la luz le quedan 400).
    let t = startHand(table([10000, 10000, 500, 10000], { structure: "luz", luz: 100 }), seededRng(5))
    t = act(t, { type: "check" }) // 1
    t = act(t, { type: "raise", to: 400 }) // 2, all-in
    t = act(t, { type: "call" }) // 3
    t = act(t, { type: "call" }) // 0
    t = act(t, { type: "call" }) // 1
    expect(t.hand!.street).toBe("flop")
    expect(t.hand!.toAct).toBe(3)
  })

  it("se queman cartas solo si alcanzan para todos", () => {
    const burnOf = (n: number, v: { game: "manhattan" | "holdem"; deck: "short" | "long" }) =>
      startHand(table(Array(n).fill(10000), { variants: [v] }), seededRng(1)).hand!.burn
    expect(burnOf(5, { game: "manhattan", deck: "short" })).toBe(true) // 25 + 5 + 3 = 33 ≤ 36
    expect(burnOf(6, { game: "manhattan", deck: "short" })).toBe(false) // 30 + 5 + 3 = 38 > 36
    expect(burnOf(8, { game: "holdem", deck: "long" })).toBe(true)
  })
})
