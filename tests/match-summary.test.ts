import { describe, expect, it } from "vitest"
import { buildMatchSummary, lastMatchMovement, sortMatchesChronologically } from "../lib/match-summary"
import type { MatchWithPlayers } from "../lib/types"

type Row = [name: string, position: number, moneyWon: number, cajitas?: number, points?: number]

const DEFAULT_POINTS = [10, 7, 5, 3, 2, 1, 0, 0]

function match(id: string, date: string, rows: Row[], createdAt = `${date}T20:00:00Z`): MatchWithPlayers {
  return {
    id,
    date,
    caji_value: 2000,
    total_money: 0,
    player_count: rows.length,
    created_at: createdAt,
    match_players: rows.map(([name, position, moneyWon, cajitas = 1, points]) => ({
      id: `${id}-${name}`,
      match_id: id,
      player_id: name,
      cajitas,
      final_chips: 0,
      money_won: moneyWon,
      position,
      points: points ?? DEFAULT_POINTS[position - 1] ?? 0,
      tie_break: 0,
      created_at: createdAt,
      players: { id: name, name, created_at: createdAt },
    })),
  }
}

describe("sortMatchesChronologically", () => {
  it("ordena por fecha y desempata por created_at", () => {
    const a = match("a", "2026-01-02", [], "2026-01-02T22:00:00Z")
    const b = match("b", "2026-01-02", [], "2026-01-02T21:00:00Z")
    const c = match("c", "2026-01-01", [])
    expect(sortMatchesChronologically([a, b, c]).map((m) => m.id)).toEqual(["c", "b", "a"])
  })
})

describe("buildMatchSummary", () => {
  const m1 = match("m1", "2026-01-01", [
    ["Ana", 1, 5000],
    ["Beto", 2, 1000],
    ["Caro", 3, -6000, 4],
  ])
  const m2 = match("m2", "2026-01-08", [
    ["Caro", 1, 9000],
    ["Ana", 2, -1000],
    ["Beto", 3, -8000, 3],
  ])

  it("lista los jugadores de la partida ordenados por posición", () => {
    const s = buildMatchSummary(m2, [m1, m2], "money")
    expect(s.players.map((p) => p.name)).toEqual(["Caro", "Ana", "Beto"])
  })

  it("calcula el movimiento en el ranking respecto de las partidas anteriores", () => {
    const s = buildMatchSummary(m2, [m1, m2], "money")
    // Antes: Ana 5000, Beto 1000, Caro -6000. Después: Ana 4000, Caro 3000, Beto -7000.
    expect(s.ranking.map((r) => [r.name, r.before, r.after, r.delta])).toEqual([
      ["Ana", 1, 1, 0],
      ["Caro", 3, 2, 1],
      ["Beto", 2, 3, -1],
    ])
    expect(s.ranking[1].total).toBe(3000)
  })

  it("el resumen de una partida vieja ignora las partidas posteriores", () => {
    const s = buildMatchSummary(m1, [m2, m1], "money")
    expect(s.ranking.map((r) => [r.name, r.before])).toEqual([
      ["Ana", null],
      ["Beto", null],
      ["Caro", null],
    ])
    // Primera partida del torneo: no hay contexto para destacar rachas ni récords.
    expect(s.highlights.map((h) => h.emoji)).toEqual(["📦"])
  })

  it("respeta el criterio de ranking por puntos", () => {
    const s = buildMatchSummary(m2, [m1, m2], "points")
    // Puntos: Ana 10+7=17, Caro 5+10=15, Beto 7+5=12.
    expect(s.ranking.map((r) => [r.name, r.total])).toEqual([
      ["Ana", 17],
      ["Caro", 15],
      ["Beto", 12],
    ])
  })

  it("destaca primera victoria, récord y compra de cajitas", () => {
    const s = buildMatchSummary(m2, [m1, m2], "money", (n) => `${n}`)
    expect(s.highlights).toEqual([
      { emoji: "🎉", text: "Primera victoria de Caro en el torneo" },
      { emoji: "💰", text: "Récord del torneo: Caro ganó $9000 en una noche" },
      { emoji: "📦", text: "Beto compró 3 cajitas" },
    ])
  })

  it("detecta rachas, nuevo líder y escaladas en el ranking", () => {
    const m3 = match("m3", "2026-01-15", [
      ["Caro", 1, 2000],
      ["Ana", 2, -1000],
      ["Beto", 3, -1000],
    ])
    const s = buildMatchSummary(m3, [m1, m2, m3], "money")
    expect(s.highlights.map((h) => h.text)).toEqual([
      "Caro ganó 2 partidas seguidas",
      "Caro es el nuevo líder del torneo",
    ])
  })

  it("una racha no se corta por partidas en las que el ganador no jugó", () => {
    const m3 = match("m3", "2026-01-15", [
      ["Ana", 1, 100],
      ["Beto", 2, -100],
    ])
    const m4 = match("m4", "2026-01-22", [
      ["Caro", 1, 100],
      ["Ana", 2, -100],
    ])
    const s = buildMatchSummary(m4, [m1, m2, m3, m4], "money")
    expect(s.highlights[0].text).toBe("Caro ganó 2 partidas seguidas")
  })

  it("destaca al que más puestos subió (2 o más)", () => {
    const a = match("a", "2026-01-01", [
      ["P1", 1, 3000],
      ["P2", 2, 2000],
      ["P3", 3, 1000],
      ["P4", 4, -6000],
    ])
    const b = match("b", "2026-01-08", [
      ["P1", 1, 10000],
      ["P4", 2, 9000],
      ["P2", 3, -9000],
      ["P3", 4, -10000],
    ])
    const s = buildMatchSummary(b, [a, b], "money")
    expect(s.ranking.find((r) => r.name === "P4")).toMatchObject({ before: 4, after: 2, delta: 2 })
    expect(s.highlights.map((h) => h.text)).toContain("P4 subió 2 puestos en el ranking")
  })
})

describe("lastMatchMovement", () => {
  const m1 = match("m1", "2026-01-01", [
    ["Ana", 1, 5000],
    ["Beto", 2, 1000],
    ["Caro", 3, -6000],
  ])
  const m2 = match("m2", "2026-01-08", [
    ["Caro", 1, 9000],
    ["Ana", 2, -1000],
    ["Beto", 3, -8000],
    ["Dani", 4, 0],
  ])

  it("devuelve el movimiento de cada jugador con la última partida", () => {
    // Antes: Ana, Beto, Caro. Después: Ana 4000, Caro 3000, Dani 0, Beto -7000.
    const mv = lastMatchMovement([m2, m1], "money")
    expect(mv.get("Ana")).toBe(0)
    expect(mv.get("Caro")).toBe(1)
    expect(mv.get("Beto")).toBe(-2)
    expect(mv.get("Dani")).toBeNull()
  })

  it("con menos de dos partidas no hay movimiento", () => {
    expect(lastMatchMovement([m1], "money").size).toBe(0)
    expect(lastMatchMovement([], "money").size).toBe(0)
  })
})

describe("buildMatchSummary · amistosa", () => {
  it("no arma ranking del torneo ni destacados que dependan de la historia", () => {
    const m1 = match("m1", "2026-01-01", [["Ana", 1, 5000], ["Beto", 2, -5000]])
    const casual = {
      ...match("c1", "2026-01-01", [["Beto", 1, 90000, 3], ["Ana", 2, -90000, 1]], "2026-01-01T23:00:00Z"),
      is_casual: true,
    }
    const summary = buildMatchSummary(casual, [m1], "money")
    expect(summary.ranking).toEqual([])
    expect(summary.players.map((p) => p.name)).toEqual(["Beto", "Ana"])
    // Solo el destacado propio de la partida (cajitas), nada de récords del torneo.
    expect(summary.highlights.map((h) => h.emoji)).toEqual(["📦"])
  })
})
