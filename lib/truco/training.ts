// Nivel y meta diaria de Practicar en La Cajita Truco. Son aparte de los del
// Entrenar de poker (lib/poker/training.ts): Truco y Poker son apps separadas.

/** Respuestas por día para cumplir la meta. */
export const TRUCO_DAILY_GOAL = 10

/** Aciertos acumulados para llegar a cada nivel (nivel 1 = 0). Después, +200 por nivel. */
const LEVEL_AT = [0, 15, 40, 80, 130, 200, 290, 400, 530, 700]

/** Los títulos suben por la jerarquía del truco: del 4 al ancho de espada. */
const LEVEL_TITLES: [number, string][] = [
  [1, "Cuatro de copa"],
  [3, "Siete falso"],
  [5, "Un tres"],
  [7, "Siete de espada"],
  [9, "Ancho de espada"],
]

const levelStart = (level: number) =>
  level <= LEVEL_AT.length ? LEVEL_AT[level - 1] : LEVEL_AT[LEVEL_AT.length - 1] + (level - LEVEL_AT.length) * 200

export interface TrucoLevelInfo {
  level: number
  title: string
  /** Aciertos dentro del nivel actual y cuántos hacen falta para pasar al siguiente. */
  into: number
  span: number
}

export function trucoLevelFor(right: number): TrucoLevelInfo {
  let level = 1
  while (levelStart(level + 1) <= right) level++
  const start = levelStart(level)
  const title = LEVEL_TITLES.filter(([from]) => from <= level).at(-1)![1]
  return { level, title, into: right - start, span: levelStart(level + 1) - start }
}
