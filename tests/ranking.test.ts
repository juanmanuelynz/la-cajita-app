import { describe, expect, it } from "vitest"
import { rankMatchPlayers } from "../lib/ranking"

describe("rankMatchPlayers", () => {
  it("ordena por moneyWon descendente", () => {
    const ranked = rankMatchPlayers([
      { cajitas: 1, finalChips: 0, moneyWon: -2000 },
      { cajitas: 1, finalChips: 5000, moneyWon: 3000 },
      { cajitas: 1, finalChips: 3000, moneyWon: 1000 },
    ])
    expect(ranked.map((r) => r.player.moneyWon)).toEqual([3000, 1000, -2000])
    expect(ranked.map((r) => r.position)).toEqual([1, 2, 3])
  })

  it("rompe empate de moneyWon por menos cajitas", () => {
    // Dos jugadores con moneyWon=0, distinto buy-in.
    const ranked = rankMatchPlayers([
      { cajitas: 3, finalChips: 6000, moneyWon: 0 },
      { cajitas: 1, finalChips: 2000, moneyWon: 0 },
    ])
    expect(ranked[0].player.cajitas).toBe(1)
    expect(ranked[1].player.cajitas).toBe(3)
  })

  it("si moneyWon y cajitas empatan, gana el que aparece antes en el array", () => {
    const a = { cajitas: 1, finalChips: 2000, moneyWon: 0, tag: "primero" }
    const b = { cajitas: 1, finalChips: 2000, moneyWon: 0, tag: "segundo" }
    const ranked = rankMatchPlayers([a, b])
    expect(ranked[0].player.tag).toBe("primero")
    expect(ranked[1].player.tag).toBe("segundo")
  })

  it("asigna tieBreak igual al índice de entrada original", () => {
    const ranked = rankMatchPlayers([
      { cajitas: 1, finalChips: 0, moneyWon: -2000 }, // entra 0, va último
      { cajitas: 1, finalChips: 5000, moneyWon: 3000 }, // entra 1, va primero
      { cajitas: 1, finalChips: 3000, moneyWon: 1000 }, // entra 2, va segundo
    ])
    // El orden de salida es 1,2,0 — y tieBreak conserva el índice de entrada.
    expect(ranked.map((r) => r.tieBreak)).toEqual([1, 2, 0])
  })

  it("es determinístico: corriéndolo dos veces sobre el mismo input da el mismo resultado", () => {
    const players = [
      { cajitas: 2, finalChips: 1000, moneyWon: -3000 },
      { cajitas: 1, finalChips: 0, moneyWon: -2000 },
      { cajitas: 1, finalChips: 4000, moneyWon: 2000 },
      { cajitas: 1, finalChips: 4000, moneyWon: 2000 },
    ]
    const a = rankMatchPlayers(players).map((r) => r.tieBreak)
    const b = rankMatchPlayers(players).map((r) => r.tieBreak)
    expect(a).toEqual(b)
  })

  it("no muta el array de entrada", () => {
    const players = [
      { cajitas: 1, finalChips: 0, moneyWon: -2000 },
      { cajitas: 1, finalChips: 4000, moneyWon: 2000 },
    ]
    const snapshot = players.map((p) => ({ ...p }))
    rankMatchPlayers(players)
    expect(players).toEqual(snapshot)
  })

  it("posiciones empiezan en 1 y no repiten", () => {
    const ranked = rankMatchPlayers(
      Array.from({ length: 8 }, (_, i) => ({
        cajitas: 1,
        finalChips: (8 - i) * 1000,
        moneyWon: (8 - i) * 1000 - 1000,
      })),
    )
    expect(ranked.map((r) => r.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })
})
