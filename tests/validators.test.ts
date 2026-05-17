import { describe, expect, it } from "vitest"
import {
  CreateMatchSchema,
  PointsConfigSchema,
  PlayerNameSchema,
  TournamentNameSchema,
} from "../lib/validators"

const TOURNAMENT_ID = "11111111-1111-1111-1111-111111111111"
const PLAYER_A = "22222222-2222-2222-2222-222222222222"
const PLAYER_B = "33333333-3333-3333-3333-333333333333"

function buildPlayer(name: string, cajitas: number, finalChips: number, cajiValue: number, playerId?: string) {
  return {
    playerId,
    name,
    cajitas,
    finalChips,
    moneyWon: finalChips - cajitas * cajiValue,
  }
}

describe("CreateMatchSchema", () => {
  const baseValid = {
    date: "2025-05-16",
    cajiValue: 2000,
    tournamentId: TOURNAMENT_ID,
    players: [
      buildPlayer("Juan", 1, 4000, 2000),
      buildPlayer("Mati", 1, 0, 2000),
    ],
  }

  it("acepta una partida bien formada y balanceada", () => {
    const result = CreateMatchSchema.safeParse(baseValid)
    expect(result.success).toBe(true)
  })

  it("rechaza partidas con menos de 2 jugadores", () => {
    const result = CreateMatchSchema.safeParse({
      ...baseValid,
      players: [buildPlayer("Juan", 1, 2000, 2000)],
    })
    expect(result.success).toBe(false)
  })

  it("rechaza partidas con más de 8 jugadores", () => {
    const players = Array.from({ length: 9 }, (_, i) =>
      buildPlayer(`P${i}`, 1, i === 0 ? 18000 : 0, 2000),
    )
    const result = CreateMatchSchema.safeParse({ ...baseValid, players })
    expect(result.success).toBe(false)
  })

  it("rechaza partidas donde la suma de fichas no cuadra con la inversión", () => {
    const result = CreateMatchSchema.safeParse({
      ...baseValid,
      players: [
        buildPlayer("Juan", 1, 3000, 2000), // se llevó 3000 pero invirtió 2000
        buildPlayer("Mati", 1, 0, 2000),    // total 3000 ≠ inversión total 4000
      ],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes("suma de fichas"))).toBe(
        true,
      )
    }
  })

  it("rechaza jugadores duplicados por nombre", () => {
    const result = CreateMatchSchema.safeParse({
      ...baseValid,
      players: [
        buildPlayer("Juan", 1, 4000, 2000),
        buildPlayer("Juan", 1, 0, 2000),
      ],
    })
    expect(result.success).toBe(false)
  })

  it("rechaza jugadores duplicados por playerId aunque los nombres difieran", () => {
    const result = CreateMatchSchema.safeParse({
      ...baseValid,
      players: [
        buildPlayer("Juan", 1, 4000, 2000, PLAYER_A),
        buildPlayer("Juancho", 1, 0, 2000, PLAYER_A),
      ],
    })
    expect(result.success).toBe(false)
  })

  it("acepta jugadores con el mismo nombre si tienen playerIds distintos", () => {
    // (case que UNIQUE en DB no permite hoy, pero el schema no debería bloquear)
    const result = CreateMatchSchema.safeParse({
      ...baseValid,
      players: [
        buildPlayer("Juan", 1, 4000, 2000, PLAYER_A),
        buildPlayer("Juan", 1, 0, 2000, PLAYER_B),
      ],
    })
    expect(result.success).toBe(true)
  })

  it("rechaza cajitas no positivas", () => {
    const result = CreateMatchSchema.safeParse({
      ...baseValid,
      players: [
        { ...buildPlayer("Juan", 0, 2000, 2000), moneyWon: 2000 },
        buildPlayer("Mati", 1, 0, 2000),
      ],
    })
    expect(result.success).toBe(false)
  })

  it("rechaza fechas con formato inválido", () => {
    const result = CreateMatchSchema.safeParse({ ...baseValid, date: "16/05/2025" })
    expect(result.success).toBe(false)
  })

  it("rechaza tournamentId no-uuid", () => {
    const result = CreateMatchSchema.safeParse({ ...baseValid, tournamentId: "abc" })
    expect(result.success).toBe(false)
  })
})

describe("PointsConfigSchema", () => {
  it("acepta una distribución válida de 8 enteros monótonos no crecientes", () => {
    expect(PointsConfigSchema.safeParse([10, 7, 5, 3, 2, 1, 0, 0]).success).toBe(true)
  })

  it("rechaza arrays con largo distinto a 8", () => {
    expect(PointsConfigSchema.safeParse([10, 7, 5, 3, 2, 1, 0]).success).toBe(false)
    expect(PointsConfigSchema.safeParse([10, 7, 5, 3, 2, 1, 0, 0, 0]).success).toBe(false)
  })

  it("rechaza distribuciones no monótonas (un valor inferior tiene más puntos que uno superior)", () => {
    expect(PointsConfigSchema.safeParse([10, 7, 5, 3, 4, 1, 0, 0]).success).toBe(false)
  })

  it("rechaza valores negativos", () => {
    expect(PointsConfigSchema.safeParse([10, 7, 5, 3, 2, 1, -1, 0]).success).toBe(false)
  })
})

describe("PlayerNameSchema", () => {
  it("recorta espacios y exige no estar vacío", () => {
    expect(PlayerNameSchema.parse("  Juan  ")).toBe("Juan")
    expect(PlayerNameSchema.safeParse("   ").success).toBe(false)
  })

  it("rechaza nombres de más de 50 caracteres", () => {
    expect(PlayerNameSchema.safeParse("a".repeat(51)).success).toBe(false)
  })
})

describe("TournamentNameSchema", () => {
  it("rechaza nombres de más de 100 caracteres", () => {
    expect(TournamentNameSchema.safeParse("a".repeat(101)).success).toBe(false)
  })
})
