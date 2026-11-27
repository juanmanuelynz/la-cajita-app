import { describe, expect, it } from "vitest"
import { seededRng } from "../lib/poker/cards"
import { decide } from "../lib/truco/ai"
import { act, actor, dealHand, newGame, type GameState, type Suit, type TrucoCard } from "../lib/truco/engine"
import { EMPTY_STATS, parseStats, ratio, updateStats, type PlayStats } from "../lib/truco/play-stats"

const c = (num: number, suit: Suit): TrucoCard => ({ num, suit })

function game(hand0: TrucoCard[], hand1: TrucoCard[], target = 30): GameState {
  const g = newGame({ target, mano: 0 }, seededRng(1))
  g.hand.dealt = [hand0.slice(), hand1.slice()]
  g.hand.cards = [hand0.slice(), hand1.slice()]
  return g
}

describe("estadísticas de Jugar", () => {
  it("cuenta el envido querido, el truco y la mano", () => {
    let st: PlayStats = { ...EMPTY_STATS }
    let g = game([c(7, "oro"), c(6, "oro"), c(1, "espada")], [c(4, "copa"), c(5, "basto"), c(6, "espada")])
    const step = (p: 0 | 1, a: Parameters<typeof act>[2]) => {
      const next = act(g, p, a)
      st = updateStats(st, g, next)
      g = next
    }
    step(0, { type: "envido", call: "envido" })
    step(1, { type: "quiero" })
    expect(st).toMatchObject({ envidos: 1, envidosWon: 1, pointsFor: 2 })
    step(0, { type: "truco" })
    step(1, { type: "quiero" })
    step(0, { type: "play", index: 2 }) // ancho de espada
    step(1, { type: "play", index: 0 })
    step(0, { type: "play", index: 0 })
    step(1, { type: "play", index: 0 })
    expect(g.hand.over).toBe(true)
    expect(st).toMatchObject({ hands: 1, handsWon: 1, trucos: 1, trucosWon: 1, pointsFor: 4, pointsAgainst: 0 })
    // Repartir no cuenta nada.
    const next = dealHand(g, seededRng(2))
    expect(updateStats(st, g, next)).toEqual(st)
  })

  it("en partidas máquina contra máquina, los totales cierran", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const rng = seededRng(seed)
      let g = newGame({ target: 15 }, rng)
      let st: PlayStats = { ...EMPTY_STATS }
      while (!g.over) {
        const next = g.hand.over ? dealHand(g, rng) : act(g, actor(g)!, decide(g, actor(g)!, rng))
        st = updateStats(st, g, next)
        g = next
      }
      expect(st.games).toBe(1)
      expect(st.wins).toBe(g.winner === 0 ? 1 : 0)
      expect(st.pointsFor).toBe(g.score[0])
      expect(st.pointsAgainst).toBe(g.score[1])
      expect(st.handsWon).toBeLessThanOrEqual(st.hands)
      expect(st.hands).toBeLessThanOrEqual(g.hands)
    }
  })

  it("lee lo guardado y porcentajes", () => {
    expect(parseStats(JSON.stringify({ ...EMPTY_STATS, games: 3, wins: 2 }))).toMatchObject({ games: 3, wins: 2 })
    expect(parseStats("roto")).toEqual(EMPTY_STATS)
    expect(parseStats(JSON.stringify({ games: -1, wins: "x" }))).toEqual(EMPTY_STATS)
    expect(ratio(2, 3)).toBe("67%")
    expect(ratio(0, 0)).toBe("—")
  })
})
