import { describe, expect, it } from "vitest"
import { parseCards, seededRng } from "../lib/poker/cards"
import {
  addHandToReads,
  BOT_NAMES,
  BOT_PROFILES,
  botAct,
  botDecide,
  botLevelOf,
  botSeatId,
  botWantsCajita,
  decide,
  EMPTY_READS,
  estimateEquity,
  estimateRangeEquity,
  KEEP,
  keepFor,
  makeBots,
  NANO_NAME,
  seatPositions,
  type BotLevel,
  type PlayerReads,
  type Situation,
} from "../lib/poker/bot"
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
      t = act(t, { type: "raise", to: 1500 }) // 0 bluffea
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

describe("Bots: leer rangos", () => {
  it("con todos los rivales en 'cualquiera' da lo mismo que la equity de siempre", () => {
    const hole = parseCards("Ah Kd")
    const a = estimateRangeEquity(hole, [], HE, [{ keep: 1, bluffMix: 0.2 }, { keep: 1, bluffMix: 0.2 }], 500, seededRng(7))
    const b = estimateEquity(hole, [], HE, 2, 500, seededRng(7))
    expect(a).toBe(b)
  })

  it("contra quien apuesta, una mano media vale menos", () => {
    // Par de 9 con un K en la mesa: contra cualquier mano está bien; contra el top 20% de lo hecho, no tanto.
    const hole = parseCards("9s 9d")
    const board = parseCards("Ks 7h 2c")
    const any = estimateRangeEquity(hole, board, HE, [{ keep: 1, bluffMix: 0 }], 3000, seededRng(8))
    const top = estimateRangeEquity(hole, board, HE, [{ keep: 0.2, bluffMix: 0 }], 3000, seededRng(8))
    expect(any).toBeGreaterThan(0.6)
    expect(top).toBeLessThan(any - 0.25)
    // Con parte de bluffs la baja es menor.
    const mixed = estimateRangeEquity(hole, board, HE, [{ keep: 0.2, bluffMix: 0.3 }], 3000, seededRng(8))
    expect(mixed).toBeGreaterThan(top)
    expect(mixed).toBeLessThan(any)
  })

  it("antes del flop en Hold'em usa la tabla de manos: AA sigue arriba contra una subida, 72 cae", () => {
    const vsRaise = [{ keep: 0.15, bluffMix: 0 }]
    expect(estimateRangeEquity(parseCards("As Ad"), [], HE, vsRaise, 3000, seededRng(9))).toBeGreaterThan(0.75)
    const low = estimateRangeEquity(parseCards("7c 2d"), [], HE, vsRaise, 3000, seededRng(9))
    expect(low).toBeLessThan(estimateEquity(parseCards("7c 2d"), [], HE, 1, 3000, seededRng(9)) - 0.05)
  })

  it("lo que le queda a cada rival según lo que hizo", () => {
    let t = startHand(createTable({ ...DEFAULT_CONFIG }, names(3)), seededRng(1))
    // Habla primero el 1 (izquierda del botón 0).
    t = act(t, { type: "raise", to: 400 }) // 1 sube
    t = act(t, { type: "call" }) // 2 paga
    t = act(t, { type: "fold" }) // 0 se va
    expect(t.hand!.street).toBe("flop")
    t = act(t, { type: "raise", to: 500 }) // 1 apuesta en el flop
    expect(keepFor(t.hand!, 1)).toBeCloseTo(Math.sqrt(KEEP.preflopRaise) * KEEP.raise)
    expect(keepFor(t.hand!, 2)).toBeCloseTo(Math.sqrt(KEEP.preflopCall))
    expect(keepFor(t.hand!, 0)).toBe(1)
  })
})

describe("Bots: niveles y Nano", () => {
  const seatsOf = (levels: BotLevel[]) => [{ id: "vos", name: "Vos" }, ...levels.map((l, i) => ({ id: botSeatId(l, i + 1), name: `${l} ${i}` }))]

  it("apodos del nivel, sin repetir, y Nano en el primer asiento si se lo desafía", () => {
    const bots = makeBots("dificil", 7, false, seededRng(1))
    expect(new Set(bots.map((b) => b.name)).size).toBe(7)
    for (const b of bots) {
      expect(BOT_NAMES.dificil).toContain(b.name)
      expect(botLevelOf(b.id)).toBe("dificil")
    }
    const withNano = makeBots("media", 4, true, seededRng(2))
    expect(withNano[0]).toEqual({ id: "nano", name: NANO_NAME })
    expect(withNano.slice(1).every((b) => botLevelOf(b.id) === "media")).toBe(true)
    for (const list of Object.values(BOT_NAMES)) expect(list).not.toContain(NANO_NAME)
    // Mesas guardadas de antes ("bot1") juegan como media.
    expect(botLevelOf("bot1")).toBe("media")
  })

  it("el fácil paga con menos de lo que necesita; el media no", () => {
    // Necesita 25%: con 20% el fácil paga y el media se va.
    const s = sit({ equity: 0.2, pot: 1500, legal: legal({ toCall: 500 }) })
    expect(decide(s, seededRng(1), BOT_PROFILES.facil).action.type).toBe("call")
    expect(decide(s, seededRng(1), BOT_PROFILES.media).action.type).toBe("fold")
  })

  it("el fácil se lee por el tamaño: chico con manos medias, grande con monstruos", () => {
    const l = legal({ canCheck: true, toCall: 0, minTo: 100, maxTo: 20000 })
    const size = (equity: number) => {
      const d = decide(sit({ legal: l, equity, pot: 2000, opponents: 2, street: "flop" }), seededRng(3), { ...BOT_PROFILES.facil, slowplay: 0 })
      return d.action.type === "raise" ? d.action.to : 0
    }
    expect(size(0.9)).toBeGreaterThanOrEqual(1800)
    // 60% contra 2 es buena (1,8 veces su parte) pero no monstruo: apuesta chico.
    expect(size(0.6)).toBeGreaterThan(0)
    expect(size(0.6)).toBeLessThanOrEqual(800)
  })

  it("Nano bluffea más a quien se va mucho y casi nada a quien paga todo", () => {
    const folder = { foldRate: 0.7, bluffRate: null }
    const station = { foldRate: 0.1, bluffRate: null }
    const bluffs = (exploit: typeof folder) => {
      const rng = seededRng(4)
      let n = 0
      for (let i = 0; i < 3000; i++) {
        const d = decide(sit({ legal: legal({ canCheck: true, toCall: 0, minTo: 100 }), equity: 0.1, street: "river", exploit }), rng, BOT_PROFILES.nano)
        if (d.action.type === "raise") n++
      }
      return n / 3000
    }
    expect(bluffs(folder)).toBeGreaterThan(bluffs(station) * 4)
    // El difícil no se adapta: le da igual.
    const rng = seededRng(4)
    const d = decide(sit({ legal: legal({ canCheck: true, toCall: 0, minTo: 100 }), equity: 0.1, street: "river", exploit: folder }), rng, BOT_PROFILES.dificil)
    expect(d.reason).not.toContain("te vio")
  })

  it("lo que aprende de vos: cuántas veces te fuiste cuando te apostaron, sin contar dos veces la misma mano", () => {
    let t = startHand(createTable({ ...DEFAULT_CONFIG }, names(2)), seededRng(1))
    // Habla primero el 1; el 0 es el que reparte.
    t = act(t, { type: "raise", to: 300 })
    t = act(t, { type: "fold" }) // 0 se va contra la apuesta
    let r: PlayerReads = addHandToReads(EMPTY_READS, t.hand!, 0, "luz")
    expect(r).toMatchObject({ hands: 1, facedBet: 1, foldedToBet: 1, shownBets: 0 })
    r = addHandToReads(r, t.hand!, 0, "luz")
    expect(r.hands).toBe(1)
    expect(addHandToReads(EMPTY_READS, t.hand!, 1, "luz")).toMatchObject({ facedBet: 0, foldedToBet: 0 })
  })

  it("lo que aprende de vos: el bluff que se vio al mostrar", () => {
    let t = createTable({ ...DEFAULT_CONFIG }, names(2))
    t = startHand(t, seededRng(1), { holes: { 0: parseCards("7c 2d"), 1: parseCards("As Ks") }, board: parseCards("Qs Js Ts 3d 4c") })
    for (let k = 0; k < 7; k++) t = act(t, { type: "check" })
    t = act(t, { type: "raise", to: 1500 }) // 0 bluffea en el river
    t = act(t, { type: "call" }) // 1 paga con la escalera real
    expect(t.hand!.result?.showdown).toBe(true)
    expect(addHandToReads(EMPTY_READS, t.hand!, 0, "luz")).toMatchObject({ shownBets: 1, shownBluffs: 1 })
    expect(addHandToReads(EMPTY_READS, t.hand!, 1, "luz")).toMatchObject({ shownBets: 0, facedBet: 1, foldedToBet: 0 })
  })

  it("el fácil no sigue los rangos de PokerStrategy: entra con cualquier cosa", () => {
    const blinds = { ...DEFAULT_CONFIG, structure: "ciegas" as const }
    const t = startHand(createTable(blinds, seatsOf(["facil", "facil", "facil", "facil", "facil"])), seededRng(1))
    expect(botDecide(t, seededRng(2), 50).source).toBe("equity")
    const m = startHand(createTable(blinds, seatsOf(["media", "media", "media", "media", "media"])), seededRng(1))
    expect(botDecide(m, seededRng(2), 50).source).toBe("pokerstrategy")
  })

  it("mesas de todos los niveles (con Nano aprendiendo) juegan manos enteras sin perder fichas", () => {
    const rng = seededRng(31)
    for (const variant of [HE, { game: "omaha", deck: "long" }, { game: "manhattan", deck: "short" }] as Variant[]) {
      const players = [{ id: "vos", name: "Vos" }, ...seatsOf(["facil", "media", "dificil"]).slice(1), { id: "nano", name: NANO_NAME }]
      let t: TableState = createTable({ ...DEFAULT_CONFIG, variants: [variant] }, players)
      let reads: PlayerReads = EMPTY_READS
      for (let hand = 0; hand < 15; hand++) {
        t.seats.forEach((_, i) => {
          if (botWantsCajita(t, i)) t = requestCajita(t, i)
        })
        t = startHand(t, rng)
        const expected = t.seats.reduce((s, x) => s + x.cajitas * t.config.cajita, 0)
        let steps = 0
        while (t.hand!.toAct !== null) {
          t = botAct(t, rng, { trials: 40, reads: { 0: reads } }).table
          expect(++steps).toBeLessThan(200)
        }
        reads = addHandToReads(reads, t.hand!, 0, t.config.structure)
        expect(t.seats.reduce((s, _, i) => s + chipsOf(t, i), 0)).toBe(expected)
      }
      expect(reads.hands).toBe(15)
    }
  }, 30000)

  it("leer rangos no los hace lentos: Manhattan con 6 en el flop después de apuestas", () => {
    let t = createTable({ ...DEFAULT_CONFIG, variants: [{ game: "manhattan", deck: "short" }] }, seatsOf(["dificil", "dificil", "dificil", "dificil", "dificil"]))
    t = startHand(t, seededRng(13))
    // Preflop: el primero sube y todos pagan; en el flop el primero apuesta.
    t = act(t, { type: "raise", to: 300 })
    while (t.hand!.street === "preflop") t = act(t, { type: "call" })
    t = act(t, { type: "raise", to: 600 })
    const t0 = performance.now()
    for (let i = 0; i < 10; i++) botDecide(t, seededRng(i))
    expect((performance.now() - t0) / 10).toBeLessThan(150)
  })
})
