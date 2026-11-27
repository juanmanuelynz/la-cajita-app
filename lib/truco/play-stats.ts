// Estadísticas de Jugar contra la máquina (Truco), en este celular. Se
// calculan comparando el estado antes y después de cada acción, así no hace
// falta tocar el motor. Puro: la pantalla las guarda en localStorage.

import type { GameState } from "./engine"

export interface PlayStats {
  /** Partidas terminadas y ganadas. */
  games: number
  wins: number
  /** Manos terminadas y ganadas. */
  hands: number
  handsWon: number
  /** Envidos que se jugaron (querido) y ganaste. */
  envidos: number
  envidosWon: number
  /** Trucos (o más) que se jugaron (querido) y ganaste la mano. */
  trucos: number
  trucosWon: number
  /** Puntos que hiciste y que hizo la máquina, en total. */
  pointsFor: number
  pointsAgainst: number
}

export const EMPTY_STATS: PlayStats = {
  games: 0,
  wins: 0,
  hands: 0,
  handsWon: 0,
  envidos: 0,
  envidosWon: 0,
  trucos: 0,
  trucosWon: 0,
  pointsFor: 0,
  pointsAgainst: 0,
}

/**
 * Suma a `stats` lo que pasó entre `prev` y `next` (el estado después de una
 * acción, o de repartir). El jugador es el 0.
 */
export function updateStats(stats: PlayStats, prev: GameState, next: GameState): PlayStats {
  const s = { ...stats }
  s.pointsFor += Math.max(0, next.score[0] - prev.score[0])
  s.pointsAgainst += Math.max(0, next.score[1] - prev.score[1])
  // Misma mano (al repartir cambia `hands` y no hay nada que contar).
  if (prev.hands !== next.hands) return s
  const h0 = prev.hand
  const h1 = next.hand
  if (h1.envido.points && !h0.envido.points) {
    s.envidos++
    if (h1.envido.winner === 0) s.envidosWon++
  }
  // La mano termina sola (bazas, mazo, no quiero) o porque la partida terminó con el envido.
  if (h1.over && !h0.over && h1.winner !== null) {
    s.hands++
    if (h1.winner === 0) s.handsWon++
    if (h1.truco.level > 0) {
      s.trucos++
      if (h1.winner === 0) s.trucosWon++
    }
  }
  if (next.over && !prev.over) {
    s.games++
    if (next.winner === 0) s.wins++
  }
  return s
}

/** Lee estadísticas guardadas (o vacías si faltan o están rotas). */
export function parseStats(raw: string | null): PlayStats {
  try {
    const x = JSON.parse(raw ?? "null")
    if (!x || typeof x !== "object") return { ...EMPTY_STATS }
    const out = { ...EMPTY_STATS }
    for (const k of Object.keys(EMPTY_STATS) as (keyof PlayStats)[]) {
      const v = x[k]
      if (Number.isInteger(v) && v >= 0) out[k] = v
    }
    return out
  } catch {
    return { ...EMPTY_STATS }
  }
}

/** "62%" o "—" si no hay datos. */
export function ratio(won: number, total: number): string {
  return total ? `${Math.round((won / total) * 100)}%` : "—"
}
