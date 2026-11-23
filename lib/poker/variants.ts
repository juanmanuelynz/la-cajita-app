import type { DeckType } from "./cards"

export type GameId = "holdem" | "omaha" | "manhattan"

export interface GameDef {
  id: GameId
  name: string
  /** Cartas que recibe cada jugador. */
  holeCount: number
  /**
   * Cuántas cartas propias puede usar para armar las 5. El resto sale de la
   * mesa. Hold'em: 0, 1 o 2 (cualquier combinación). Omaha: exactamente 2.
   * Manhattan: 2 o 3.
   */
  holeUse: readonly number[]
  /** Regla para armar la mano, en una línea. */
  rule: string
}

export const GAMES: Record<GameId, GameDef> = {
  holdem: {
    id: "holdem",
    name: "Hold'em",
    holeCount: 2,
    holeUse: [0, 1, 2],
    rule: "2 cartas propias. La mejor mano de 5 con cualquier combinación de tus cartas y las de la mesa.",
  },
  omaha: {
    id: "omaha",
    name: "Omaha",
    holeCount: 4,
    holeUse: [2],
    rule: "4 cartas propias. Usás SÍ O SÍ 2 de tu mano y 3 de la mesa.",
  },
  manhattan: {
    id: "manhattan",
    name: "Manhattan",
    holeCount: 5,
    holeUse: [2, 3],
    rule: "5 cartas propias. Usás 2 de tu mano con 3 de la mesa, o 3 de tu mano con 2 de la mesa.",
  },
}

export const GAME_IDS: GameId[] = ["holdem", "omaha", "manhattan"]

export interface Variant {
  game: GameId
  deck: DeckType
}

export const DECK_NAMES: Record<DeckType, string> = {
  long: "Mazo largo",
  short: "Mazo corto",
}

export function variantName(v: Variant): string {
  return `${GAMES[v.game].name} · ${v.deck === "short" ? "corto" : "largo"}`
}

/** Cartas en la mesa por calle. */
export const BOARD_BY_STREET = { flop: 3, turn: 4, river: 5 } as const
export type Street = keyof typeof BOARD_BY_STREET

/** Máximo de jugadores que entran en el mazo (cartas propias + 5 de la mesa). */
export function maxPlayers(v: Variant, cap = 6): number {
  const deck = v.deck === "short" ? 36 : 52
  return Math.min(cap, Math.floor((deck - 5) / GAMES[v.game].holeCount))
}
