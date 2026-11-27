// Anotador de Truco para partidas de verdad (dos equipos, a 15 o a 30). Lógica
// pura: la pantalla es components/truco/anotador.tsx y el estado se guarda en
// localStorage. Se suma de a un punto (tocar) y se resta de a uno (mantener).

export type Team = 0 | 1

export interface ScorerState {
  names: [string, string]
  target: 15 | 30
  score: [number, number]
  /** Partidas ganadas por cada equipo (se cuentan al llegar al final). */
  wins: [number, number]
  /** Si la partida actual ya sumó a `wins` (para descontarla si se resta). */
  counted: boolean
}

export const DEFAULT_NAMES: [string, string] = ["Nosotros", "Ellos"]

/** Partida nueva; conserva nombres, objetivo y partidas ganadas de `prev`. */
export function freshScorer(prev?: Partial<ScorerState>): ScorerState {
  return {
    names: prev?.names ?? [...DEFAULT_NAMES],
    target: prev?.target ?? 30,
    score: [0, 0],
    wins: prev?.wins ?? [0, 0],
    counted: false,
  }
}

/** El equipo que llegó al final, o null. */
export function scorerWinner(s: ScorerState): Team | null {
  if (s.score[0] >= s.target) return 0
  if (s.score[1] >= s.target) return 1
  return null
}

export function addPoint(s: ScorerState, team: Team): ScorerState {
  if (scorerWinner(s) !== null) return s
  const score: [number, number] = [...s.score]
  score[team]++
  const next = { ...s, score }
  const w = scorerWinner(next)
  if (w !== null && !s.counted) {
    const wins: [number, number] = [...s.wins]
    wins[w]++
    return { ...next, wins, counted: true }
  }
  return next
}

export function removePoint(s: ScorerState, team: Team): ScorerState {
  if (s.score[team] === 0) return s
  const before = scorerWinner(s)
  const score: [number, number] = [...s.score]
  score[team]--
  const next = { ...s, score }
  // Si se deshace el punto que ganó la partida, se descuenta la ganada.
  if (before !== null && scorerWinner(next) === null && s.counted) {
    const wins: [number, number] = [...s.wins]
    wins[before]--
    return { ...next, wins, counted: false }
  }
  return next
}

export function setTarget(s: ScorerState, target: 15 | 30): ScorerState {
  return target === s.target ? s : { ...freshScorer(s), target }
}

export function renameTeam(s: ScorerState, team: Team, name: string): ScorerState {
  const names: [string, string] = [...s.names]
  names[team] = name.trim().slice(0, 18) || DEFAULT_NAMES[team]
  return { ...s, names }
}

/** Malas y buenas de un puntaje (a 15 todo cuenta como malas). */
export function halves(score: number, target: number): { malas: number; buenas: number } {
  if (target !== 30) return { malas: score, buenas: 0 }
  return { malas: Math.min(score, 15), buenas: Math.max(0, score - 15) }
}

/** Lee un estado guardado, o uno nuevo si falta o está roto. */
export function parseScorer(raw: string | null): ScorerState {
  try {
    const s = JSON.parse(raw ?? "null")
    if (!s || (s.target !== 15 && s.target !== 30)) return freshScorer()
    const pair = (x: unknown, max: number): [number, number] =>
      Array.isArray(x) && x.length === 2 && x.every((n) => Number.isInteger(n) && n >= 0)
        ? [Math.min(x[0], max), Math.min(x[1], max)]
        : [0, 0]
    const names: [string, string] =
      Array.isArray(s.names) && s.names.length === 2 && s.names.every((n: unknown) => typeof n === "string")
        ? [s.names[0], s.names[1]]
        : [...DEFAULT_NAMES]
    return {
      names,
      target: s.target,
      score: pair(s.score, s.target),
      wins: pair(s.wins, Number.MAX_SAFE_INTEGER),
      counted: !!s.counted,
    }
  } catch {
    return freshScorer()
  }
}
