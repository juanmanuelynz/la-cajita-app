import { describe, expect, it } from "vitest"
import { POINTS_CONFIG_PRESETS, POINTS_DISTRIBUTION } from "../lib/constants"
import { PointsConfigSchema } from "../lib/validators"

describe("POINTS_DISTRIBUTION", () => {
  it("tiene exactamente 8 posiciones", () => {
    expect(POINTS_DISTRIBUTION).toHaveLength(8)
  })

  it("es monótono no creciente (puesto N nunca da más puntos que N-1)", () => {
    for (let i = 1; i < POINTS_DISTRIBUTION.length; i++) {
      expect(POINTS_DISTRIBUTION[i]).toBeLessThanOrEqual(POINTS_DISTRIBUTION[i - 1])
    }
  })

  it("no tiene puntos negativos", () => {
    expect(POINTS_DISTRIBUTION.every((p) => p >= 0)).toBe(true)
  })

  it("pasa el PointsConfigSchema (mismo contrato que torneos)", () => {
    expect(PointsConfigSchema.safeParse([...POINTS_DISTRIBUTION]).success).toBe(true)
  })
})

describe("POINTS_CONFIG_PRESETS", () => {
  it("todos los presets pasan el PointsConfigSchema", () => {
    for (const [name, config] of Object.entries(POINTS_CONFIG_PRESETS)) {
      const result = PointsConfigSchema.safeParse(config)
      expect(result.success, `preset "${name}" debería ser válido`).toBe(true)
    }
  })
})
