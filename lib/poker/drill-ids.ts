// La lista de ejercicios de Entrenar, sola (sin generadores) para que la puedan
// importar la validación del servidor y la dificultad sin cargar todo el motor.
// Cómo agregar un ejercicio: docs/motor-entrenar.md.

// Al final siempre: el desafío sortea por índice (ver dailyDrills en training.ts).
export const DRILL_IDS = [
  "usable",
  "whoWins",
  "outs",
  "potOdds",
  "compare",
  "preflop",
  "luz",
  "gto",
  "preflopVs",
  "betOrCheck",
  "semiBluff",
  "shove",
  "callDown",
] as const
export type DrillId = (typeof DRILL_IDS)[number]

/**
 * Ejercicios de cuentas: valen igual en todos los juegos y mazos (no se elige
 * juego) y no tienen dificultad (son fórmulas fijas).
 */
export const GAME_FREE_DRILLS: readonly DrillId[] = ["gto", "betOrCheck", "semiBluff", "shove", "callDown"]
export const isGameFree = (d: DrillId) => GAME_FREE_DRILLS.includes(d)
