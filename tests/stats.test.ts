import { describe, expect, it } from "vitest"
import { sortPlayerStats } from "../lib/stats"
import type { PlayerStats } from "../lib/types"

function stat(
  name: string,
  points: number,
  moneyWon: number,
  cajitas: number,
  matches = 5,
): PlayerStats {
  return {
    id: name,
    name,
    points,
    moneyWon,
    cajitas,
    matches,
    averagePerMatch: matches > 0 ? moneyWon / matches : 0,
  }
}

describe("sortPlayerStats", () => {
  it("filtra jugadores sin partidas", () => {
    const result = sortPlayerStats(
      [stat("Sin partidas", 10, 5000, 1, 0), stat("Con partidas", 5, 1000, 2, 3)],
      "points",
    )
    expect(result.map((p) => p.name)).toEqual(["Con partidas"])
  })

  it("sortBy='points': ordena por puntos, desempata por moneyWon, luego por menos cajitas", () => {
    const result = sortPlayerStats(
      [
        stat("Tercero", 5, 0, 1),
        stat("Primero", 10, 0, 5),
        stat("Segundo-más-plata", 7, 5000, 2),
        stat("Segundo-menos-plata", 7, 0, 1),
      ],
      "points",
    )
    expect(result.map((p) => p.name)).toEqual([
      "Primero",
      "Segundo-más-plata",
      "Segundo-menos-plata",
      "Tercero",
    ])
  })

  it("sortBy='money': ordena por moneyWon, desempata por puntos, luego por menos cajitas", () => {
    const result = sortPlayerStats(
      [
        stat("Pierde mucho", 10, -5000, 3),
        stat("Gana mucho", 5, 10000, 5),
        stat("Equilibrado-con-puntos", 10, 0, 5),
        stat("Equilibrado-sin-puntos", 1, 0, 2),
      ],
      "money",
    )
    expect(result.map((p) => p.name)).toEqual([
      "Gana mucho",
      "Equilibrado-con-puntos",
      "Equilibrado-sin-puntos",
      "Pierde mucho",
    ])
  })

  it("no muta el array de entrada", () => {
    const original = [stat("A", 1, 0, 1), stat("B", 2, 0, 1)]
    const snapshot = original.map((p) => ({ ...p }))
    sortPlayerStats(original, "points")
    expect(original).toEqual(snapshot)
  })

  it("desempate final por menos cajitas cuando puntos y moneyWon son idénticos", () => {
    const result = sortPlayerStats(
      [stat("Más cajitas", 10, 5000, 5), stat("Menos cajitas", 10, 5000, 2)],
      "points",
    )
    expect(result.map((p) => p.name)).toEqual(["Menos cajitas", "Más cajitas"])
  })
})
