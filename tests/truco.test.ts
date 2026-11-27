import { describe, expect, it } from "vitest"
import { seededRng } from "../lib/poker/cards"
import { BOT_LEVELS, decide } from "../lib/truco/ai"
import {
  act,
  actor,
  compare,
  dealHand,
  deck,
  envidoNoQuerido,
  envidoPoints,
  envidoQuerido,
  envidoRaises,
  handWinner,
  LADDER,
  legal,
  newGame,
  rank,
  trucoValue,
  type GameState,
  type Player,
  type Suit,
  type TrucoAction,
  type TrucoCard,
} from "../lib/truco/engine"

const c = (num: number, suit: Suit): TrucoCard => ({ num, suit })

/** Partida a medida: el jugador 0 es mano y las cartas son las que se pasan. */
function game(hand0: TrucoCard[], hand1: TrucoCard[], over: { target?: number; score?: [number, number]; mano?: Player } = {}): GameState {
  const g = newGame({ target: over.target ?? 30, mano: over.mano ?? 0 }, seededRng(1))
  g.hand.dealt = [hand0.slice(), hand1.slice()]
  g.hand.cards = [hand0.slice(), hand1.slice()]
  if (over.score) g.score = over.score
  return g
}

const play = (g: GameState, p: Player, card: TrucoCard) =>
  act(g, p, { type: "play", index: g.hand.cards[p].findIndex((x) => x.num === card.num && x.suit === card.suit) })

describe("jerarquía", () => {
  it("tiene 14 escalones que cubren las 40 cartas, de mayor a menor", () => {
    expect(LADDER).toHaveLength(14)
    expect(LADDER.flatMap((s) => s.cards)).toHaveLength(40)
    LADDER.forEach((step, i) => {
      for (const card of step.cards) expect(rank(card)).toBe(14 - i)
    })
    expect(deck()).toHaveLength(40)
  })

  it("compara cartas y detecta pardas", () => {
    expect(compare(c(1, "espada"), c(1, "basto"))).toBe(0)
    expect(compare(c(4, "oro"), c(7, "copa"))).toBe(1)
    expect(compare(c(3, "oro"), c(3, "basto"))).toBe(-1)
    expect(compare(c(1, "oro"), c(1, "copa"))).toBe(-1)
    expect(compare(c(7, "oro"), c(3, "espada"))).toBe(0)
  })
})

describe("envido", () => {
  it("cuenta los tantos de los ejemplos de la lección", () => {
    expect(envidoPoints([c(7, "oro"), c(6, "oro"), c(1, "espada")])).toBe(33)
    expect(envidoPoints([c(12, "copa"), c(5, "copa"), c(3, "basto")])).toBe(25)
    expect(envidoPoints([c(11, "oro"), c(4, "basto"), c(6, "espada")])).toBe(6)
    // Tres del mismo palo, sin flor: las dos más altas.
    expect(envidoPoints([c(7, "basto"), c(5, "basto"), c(11, "basto")])).toBe(32)
    // Solo figuras de palos distintos: 0.
    expect(envidoPoints([c(10, "oro"), c(11, "copa"), c(12, "espada")])).toBe(0)
  })

  it("vale lo de la tabla de la lección (quiero / no quiero)", () => {
    const rows: [Parameters<typeof envidoNoQuerido>[0], number, number][] = [
      [["envido"], 2, 1],
      [["real"], 3, 1],
      [["envido", "envido"], 4, 2],
      [["envido", "real"], 5, 2],
      [["envido", "envido", "real"], 7, 4],
    ]
    for (const [calls, q, nq] of rows) {
      expect(envidoQuerido(calls, [0, 0], 30)).toBe(q)
      expect(envidoNoQuerido(calls)).toBe(nq)
    }
    // Falta envido: lo que le falta al que va ganando; no querido, 1 o lo cantado antes.
    expect(envidoQuerido(["falta"], [12, 22], 30)).toBe(8)
    expect(envidoQuerido(["envido", "falta"], [3, 4], 15)).toBe(11)
    expect(envidoNoQuerido(["falta"])).toBe(1)
    expect(envidoNoQuerido(["envido", "real", "falta"])).toBe(5)
  })

  it("solo deja subir lo que corresponde", () => {
    expect(envidoRaises([])).toEqual(["envido", "real", "falta"])
    expect(envidoRaises(["envido"])).toEqual(["envido", "real", "falta"])
    expect(envidoRaises(["envido", "envido"])).toEqual(["real", "falta"])
    expect(envidoRaises(["real"])).toEqual(["falta"])
    expect(envidoRaises(["falta"])).toEqual([])
  })

  it("querido: gana el de más tantos y en empate el mano", () => {
    let g = game([c(7, "oro"), c(6, "oro"), c(4, "basto")], [c(7, "copa"), c(6, "copa"), c(1, "espada")])
    g = act(g, 0, { type: "envido", call: "envido" })
    g = act(g, 1, { type: "quiero" })
    expect(g.hand.envido.winner).toBe(0) // 33 a 33: gana el mano
    expect(g.score).toEqual([2, 0])
    expect(actor(g)).toBe(0) // sigue la mano
  })

  it("no querido: el que cantó suma y la mano sigue", () => {
    let g = game([c(4, "oro"), c(5, "copa"), c(12, "basto")], [c(7, "copa"), c(6, "copa"), c(1, "espada")])
    g = act(g, 0, { type: "envido", call: "envido" })
    g = act(g, 1, { type: "envido", call: "real" })
    g = act(g, 0, { type: "noQuiero" })
    expect(g.score).toEqual([0, 2])
    expect(legal(g, 0).envido).toEqual([])
    expect(legal(g, 0).play).toBe(true)
  })

  it("se canta en la primera baza antes de tirar, pero se puede subir después de tirar", () => {
    let g = game([c(4, "oro"), c(5, "copa"), c(12, "basto")], [c(7, "copa"), c(6, "copa"), c(1, "espada")])
    g = play(g, 0, c(4, "oro"))
    expect(legal(g, 0).envido).toEqual([]) // no le toca
    expect(legal(g, 1).envido).toEqual(["envido", "real", "falta"])
    g = act(g, 1, { type: "envido", call: "envido" })
    // El mano ya tiró, pero puede contestar subiendo.
    expect(legal(g, 0).envido).toEqual(["envido", "real", "falta"])
    g = act(g, 0, { type: "envido", call: "real" })
    g = act(g, 1, { type: "quiero" })
    expect(g.score).toEqual([0, 5]) // 33 contra 5
    // Ya no se puede cantar en segunda.
    g = play(g, 1, c(1, "espada"))
    expect(legal(g, 1).envido).toEqual([])
  })

  it("falta envido querido que llega al final termina la partida en el acto", () => {
    let g = game([c(7, "oro"), c(6, "oro"), c(4, "basto")], [c(4, "copa"), c(5, "espada"), c(1, "basto")], {
      target: 15,
      score: [10, 12],
    })
    g = act(g, 0, { type: "envido", call: "falta" })
    g = act(g, 1, { type: "quiero" })
    expect(g.score).toEqual([13, 12]) // 10 + (15 − 12)
    expect(g.over).toBe(false)
    g = game([c(7, "oro"), c(6, "oro"), c(4, "basto")], [c(4, "copa"), c(5, "espada"), c(1, "basto")], {
      target: 15,
      score: [12, 3],
    })
    g = act(g, 0, { type: "envido", call: "falta" })
    g = act(g, 1, { type: "quiero" })
    expect(g.score).toEqual([15, 3])
    expect(g.over).toBe(true)
    expect(g.winner).toBe(0)
    expect(actor(g)).toBeNull()
  })
})

describe("truco", () => {
  it("vale 2 / 3 / 4 querido y lo anterior no querido", () => {
    expect([0, 1, 2, 3].map((l) => trucoValue(l as 0 | 1 | 2 | 3))).toEqual([1, 2, 3, 4])
    const hands = (): [TrucoCard[], TrucoCard[]] => [
      [c(4, "oro"), c(5, "copa"), c(12, "basto")],
      [c(7, "copa"), c(6, "copa"), c(1, "espada")],
    ]
    // Truco no querido: 1.
    let g = game(...hands())
    g = act(g, 0, { type: "truco" })
    g = act(g, 1, { type: "noQuiero" })
    expect(g.score).toEqual([1, 0])
    // Quiero retruco, y el vale cuatro no querido: 3.
    g = game(...hands())
    g = act(g, 0, { type: "truco" })
    g = act(g, 1, { type: "truco" }) // quiero retruco
    expect(g.hand.truco.level).toBe(1)
    g = act(g, 0, { type: "truco" }) // quiero vale cuatro
    g = act(g, 1, { type: "noQuiero" })
    expect(g.score).toEqual([3, 0])
    // Retruco no querido: 2.
    g = game(...hands())
    g = act(g, 0, { type: "truco" })
    g = act(g, 1, { type: "truco" })
    g = act(g, 0, { type: "noQuiero" })
    expect(g.score).toEqual([0, 2])
  })

  it("una vez querido, solo puede subir quien quiso", () => {
    let g = game([c(4, "oro"), c(5, "copa"), c(12, "basto")], [c(7, "copa"), c(6, "copa"), c(1, "espada")])
    g = act(g, 0, { type: "truco" })
    g = act(g, 1, { type: "quiero" })
    expect(legal(g, 0).truco).toBeNull()
    g = play(g, 0, c(4, "oro"))
    expect(legal(g, 1).truco).toBe(2)
    g = act(g, 1, { type: "truco" })
    g = act(g, 0, { type: "quiero" })
    g = play(g, 1, c(7, "copa")) // gana la primera y vuelve a tirar
    g = play(g, 1, c(6, "copa"))
    expect(legal(g, 0).truco).toBe(3) // ahora sube el que quiso el retruco
    expect(legal(g, 1).truco).toBeNull()
  })

  it("el envido va primero: al truco se le contesta con envido y después se contesta el truco", () => {
    let g = game([c(4, "oro"), c(5, "copa"), c(12, "basto")], [c(7, "copa"), c(6, "copa"), c(1, "espada")])
    g = act(g, 0, { type: "truco" })
    expect(legal(g, 1).envido).toEqual(["envido", "real", "falta"])
    g = act(g, 1, { type: "envido", call: "envido" })
    g = act(g, 0, { type: "noQuiero" })
    expect(g.score).toEqual([0, 1])
    // Vuelve el truco, para el mismo que lo tenía que contestar.
    expect(g.hand.pending).toEqual({ kind: "truco", by: 0, level: 1 })
    expect(actor(g)).toBe(1)
    expect(legal(g, 1).envido).toEqual([])
    g = act(g, 1, { type: "quiero" })
    expect(g.hand.truco.level).toBe(1)
  })

  it("con truco querido ya no se canta envido", () => {
    let g = game([c(4, "oro"), c(5, "copa"), c(12, "basto")], [c(7, "copa"), c(6, "copa"), c(1, "espada")])
    g = act(g, 0, { type: "truco" })
    g = act(g, 1, { type: "quiero" })
    expect(legal(g, 0).envido).toEqual([])
  })

  it("irse al mazo da lo que vale la mano, sin envido", () => {
    let g = game([c(4, "oro"), c(5, "copa"), c(12, "basto")], [c(7, "copa"), c(6, "copa"), c(1, "espada")])
    g = act(g, 0, { type: "mazo" })
    expect(g.score).toEqual([0, 1])
    expect(g.hand.over).toBe(true)
    g = game([c(4, "oro"), c(5, "copa"), c(12, "basto")], [c(7, "copa"), c(6, "copa"), c(1, "espada")])
    g = act(g, 0, { type: "truco" })
    g = act(g, 1, { type: "quiero" })
    g = act(g, 0, { type: "mazo" })
    expect(g.score).toEqual([0, 2])
  })
})

describe("bazas y pardas", () => {
  it("los tres casos de la lección y las tres pardas", () => {
    // Primera parda: define la segunda.
    expect(handWinner([-1, 1], 0)).toBe(1)
    // Ganó la primera y después parda: gana quien ganó la primera.
    expect(handWinner([0, -1], 1)).toBe(0)
    expect(handWinner([1, 0, -1], 0)).toBe(1)
    // Las tres pardas: gana el mano.
    expect(handWinner([-1, -1, -1], 1)).toBe(1)
    // Sin definir todavía.
    expect(handWinner([0, 1], 0)).toBeNull()
    expect(handWinner([-1, -1], 0)).toBeNull()
    expect(handWinner([0], 0)).toBeNull()
    // Dos ganadas seguidas.
    expect(handWinner([1, 1], 0)).toBe(1)
  })

  it("quien gana una baza tira primero; tras una parda tira el mano", () => {
    // El jugador 1 es mano.
    let g = game([c(3, "oro"), c(4, "copa"), c(12, "basto")], [c(3, "espada"), c(5, "copa"), c(1, "espada")], { mano: 1 })
    expect(g.mano).toBe(1)
    expect(actor(g)).toBe(1)
    g = play(g, 1, c(3, "espada"))
    g = play(g, 0, c(3, "oro")) // parda
    expect(g.hand.tricks[0].winner).toBe(-1)
    expect(actor(g)).toBe(1) // el mano, aunque el 0 cerró la baza
    g = play(g, 1, c(5, "copa"))
    g = play(g, 0, c(12, "basto")) // gana el 0 la segunda y la mano
    expect(g.hand.over).toBe(true)
    expect(g.score).toEqual([1, 0])
  })

  it("si alguien gana las dos primeras, la tercera no se juega", () => {
    let g = game([c(1, "espada"), c(1, "basto"), c(4, "oro")], [c(4, "copa"), c(5, "copa"), c(6, "espada")])
    g = play(g, 0, c(1, "espada"))
    g = play(g, 1, c(4, "copa"))
    expect(actor(g)).toBe(0)
    g = play(g, 0, c(1, "basto"))
    g = play(g, 1, c(5, "copa"))
    expect(g.hand.over).toBe(true)
    expect(g.hand.tricks).toHaveLength(2)
  })
})

describe("estado", () => {
  it("act no toca el estado anterior y tira error si no es legal", () => {
    const g = game([c(4, "oro"), c(5, "copa"), c(12, "basto")], [c(7, "copa"), c(6, "copa"), c(1, "espada")])
    const before = JSON.stringify(g)
    act(g, 0, { type: "truco" })
    expect(JSON.stringify(g)).toBe(before)
    expect(() => act(g, 1, { type: "play", index: 0 })).toThrow()
    expect(() => act(g, 0, { type: "quiero" })).toThrow()
    // Se puede guardar y volver a leer (localStorage).
    expect(JSON.parse(JSON.stringify(g))).toEqual(g)
  })

  it("el mano se alterna en cada mano y se reparten 3 cartas distintas", () => {
    let g = newGame({ target: 30, mano: 0 }, seededRng(7))
    expect(g.mano).toBe(0)
    g = act(g, 0, { type: "mazo" })
    g = dealHand(g, seededRng(8))
    expect(g.mano).toBe(1)
    expect(g.hands).toBe(2)
    const all = [...g.hand.cards[0], ...g.hand.cards[1]].map((x) => `${x.num}-${x.suit}`)
    expect(new Set(all).size).toBe(6)
  })
})

describe("máquina contra máquina", () => {
  it("las partidas terminan siempre, solo con acciones legales y sin pasarse del objetivo", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const rng = seededRng(seed)
      const target = seed % 2 ? 15 : 30
      let g = newGame({ target, mano: (seed % 2) as Player }, rng)
      let steps = 0
      while (!g.over) {
        if (g.hand.over) {
          g = dealHand(g, rng)
          continue
        }
        const p = actor(g)!
        const a: TrucoAction = decide(g, p, rng)
        const before = g.score[0] + g.score[1]
        g = act(g, p, a) // tira si la acción no es legal
        expect(g.score[0] + g.score[1]).toBeGreaterThanOrEqual(before)
        expect(Math.max(...g.score)).toBeLessThanOrEqual(target)
        expect(++steps).toBeLessThan(5000)
      }
      expect(g.winner).not.toBeNull()
      expect(g.score[g.winner!]).toBe(target)
    }
  })
})

describe("niveles de la máquina", () => {
  it("cada nivel termina sus partidas jugando solo acciones legales", () => {
    for (const level of BOT_LEVELS) {
      for (let seed = 1; seed <= (level === "dificil" ? 4 : 10); seed++) {
        const rng = seededRng(seed * 31)
        let g = newGame({ target: 15, mano: (seed % 2) as Player }, rng)
        while (!g.over) {
          if (g.hand.over) {
            g = dealHand(g, rng)
            continue
          }
          const p = actor(g)!
          g = act(g, p, decide(g, p, rng, level)) // tira si no es legal
        }
        expect(g.winner).not.toBeNull()
      }
    }
  })
})

