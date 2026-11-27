import { describe, expect, it } from "vitest"
import { seededRng } from "../lib/poker/cards"
import { compare, envidoPoints, sameCard } from "../lib/truco/engine"
import { MAKERS, makeEnvido, makeGana } from "../lib/truco/quizzes"
import { TRUCO_QUIZ_IDS } from "../lib/truco/quiz-ids"
import { trucoLevelFor } from "../lib/truco/training"

describe("ejercicios de Practicar", () => {
  it("cada ejercicio tiene una sola opción correcta y opciones distintas", () => {
    const rng = seededRng(42)
    for (const id of TRUCO_QUIZ_IDS) {
      for (let i = 0; i < 600; i++) {
        const q = MAKERS[id](rng)
        expect(q.id).toBe(id)
        expect(q.options.filter((o) => o.ok)).toHaveLength(1)
        const keys = q.options.map((o) => o.label ?? `${o.card!.num}-${o.card!.suit}`)
        expect(new Set(keys).size).toBe(keys.length)
        if (id !== "gana") expect(q.options).toHaveLength(4)
      }
    }
  })

  it("¿Qué carta gana? responde como la jerarquía, con pardas a veces", () => {
    const rng = seededRng(7)
    let pardas = 0
    for (let i = 0; i < 400; i++) {
      const q = makeGana(rng)
      const [a, b] = [q.options[0].card!, q.options[1].card!]
      expect(sameCard(a, b)).toBe(false)
      const w = compare(a, b)
      expect(q.options[w === -1 ? 2 : w].ok).toBe(true)
      if (w === -1) pardas++
    }
    expect(pardas).toBeGreaterThan(20)
  })

  it("¿Cuántos tantos? usa tres cartas distintas y la respuesta es su envido", () => {
    const rng = seededRng(9)
    for (let i = 0; i < 400; i++) {
      const q = makeEnvido(rng)
      const [a, b, c] = q.cards!
      expect(sameCard(a, b) || sameCard(a, c) || sameCard(b, c)).toBe(false)
      expect(Number(q.options.find((o) => o.ok)!.label)).toBe(envidoPoints(q.cards!))
    }
  })

  it("es repetible con la misma semilla", () => {
    expect(makeEnvido(seededRng(3))).toEqual(makeEnvido(seededRng(3)))
  })

  it("nivel por aciertos", () => {
    expect(trucoLevelFor(0)).toMatchObject({ level: 1, title: "Cuatro de copa", into: 0, span: 15 })
    expect(trucoLevelFor(15).level).toBe(2)
    expect(trucoLevelFor(700)).toMatchObject({ level: 10, title: "Ancho de espada" })
    expect(trucoLevelFor(900).level).toBe(11)
  })
})
