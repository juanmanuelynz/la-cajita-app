// Reglas del truco argentino, mano a mano (dos jugadores), sin flor. Port del
// módulo `engine` del artefacto "Truco argentino" (ver docs/plan-truco.md).
// Código puro: no sabe de pantallas ni de la máquina.
//
// El estado es un objeto plano (se puede guardar en localStorage); cada función
// devuelve uno nuevo sin tocar el anterior. El azar entra solo al repartir, por
// el parámetro `rng` (sembrable en los tests).
//
// Reglas que no salen tal cual de las lecciones (decididas el 27/11/2026):
// - Después de una baza parda, tira primero el mano.
// - Si te cantan envido, podés subirlo (real / falta) aunque ya hayas tirado tu
//   primera carta; lo que no podés es cantarlo vos primero.
// - Irse al mazo da solo lo que vale la mano, sin puntos de envido.
// - Flor (opcional por partida, `flor: true` en newGame; decidido el 27/11/2026):
//   quien tiene flor la canta antes de tirar su primera carta (no puede hacer
//   otra cosa antes) y anula el envido. Si el otro no tiene, suma 3. Si los dos
//   tienen, el otro contesta "con flor me achico" (el primero suma 3),
//   "contraflor" (querida: el de más flor suma 6; no querida: el que la cantó
//   suma 4) o "contraflor al resto" (querida: lo que le falta al que va
//   ganando; no querida: 4). Empate de flor: gana el mano.

import { shuffle, type Rng } from "../poker/cards"

export type Suit = "espada" | "basto" | "oro" | "copa"
export type Player = 0 | 1
export interface TrucoCard {
  num: number
  suit: Suit
}

export const SUITS: readonly Suit[] = ["espada", "basto", "oro", "copa"]
export const NUMS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12]

export function deck(): TrucoCard[] {
  const d: TrucoCard[] = []
  for (const suit of SUITS) for (const num of NUMS) d.push({ num, suit })
  return d
}

/** Jerarquía: más alto gana (14 = ancho de espada, 1 = los 4). */
export function rank(c: TrucoCard): number {
  if (c.num === 1 && c.suit === "espada") return 14
  if (c.num === 1 && c.suit === "basto") return 13
  if (c.num === 7 && c.suit === "espada") return 12
  if (c.num === 7 && c.suit === "oro") return 11
  if (c.num === 3) return 10
  if (c.num === 2) return 9
  if (c.num === 1) return 8 // 1 de copa y 1 de oro (anchos falsos)
  if (c.num === 12) return 7
  if (c.num === 11) return 6
  if (c.num === 10) return 5
  if (c.num === 7) return 4 // 7 de copa y 7 de basto (sietes falsos)
  if (c.num === 6) return 3
  if (c.num === 5) return 2
  return 1 // 4
}

export interface LadderStep {
  cards: TrucoCard[]
  name: string
  note: string
}

const all = (num: number) => SUITS.map((suit) => ({ num, suit }))

/** Los catorce escalones de la jerarquía, de la más fuerte a la más débil. */
export const LADDER: readonly LadderStep[] = [
  { cards: [{ num: 1, suit: "espada" }], name: "Ancho de espada", note: "La mejor carta del mazo." },
  { cards: [{ num: 1, suit: "basto" }], name: "Ancho de basto", note: "Solo pierde con el ancho de espada." },
  { cards: [{ num: 7, suit: "espada" }], name: "Siete de espada", note: "" },
  { cards: [{ num: 7, suit: "oro" }], name: "Siete de oro", note: "" },
  { cards: all(3), name: "Los cuatro 3", note: "Empatan entre sí." },
  { cards: all(2), name: "Los cuatro 2", note: "" },
  { cards: [{ num: 1, suit: "oro" }, { num: 1, suit: "copa" }], name: "Anchos falsos", note: "1 de oro y 1 de copa." },
  { cards: all(12), name: "Los reyes (12)", note: "" },
  { cards: all(11), name: "Los caballos (11)", note: "" },
  { cards: all(10), name: "Las sotas (10)", note: "" },
  { cards: [{ num: 7, suit: "copa" }, { num: 7, suit: "basto" }], name: "Sietes falsos", note: "7 de copa y 7 de basto." },
  { cards: all(6), name: "Los 6", note: "" },
  { cards: all(5), name: "Los 5", note: "" },
  { cards: all(4), name: "Los 4", note: "Las más débiles." },
]

export function cardName(c: TrucoCard): string {
  const special: Record<string, string> = {
    "1-espada": "el ancho de espada",
    "1-basto": "el ancho de basto",
    "7-espada": "el siete de espada",
    "7-oro": "el siete de oro",
  }
  const s = special[`${c.num}-${c.suit}`]
  if (s) return s
  const fig: Record<number, string> = { 10: "la sota", 11: "el caballo", 12: "el rey" }
  return fig[c.num] ? `${fig[c.num]} de ${c.suit}` : `el ${c.num} de ${c.suit}`
}

export const sameCard = (a: TrucoCard | null | undefined, b: TrucoCard | null | undefined): boolean =>
  !!a && !!b && a.num === b.num && a.suit === b.suit

/** Resultado de una baza: 0 o 1 gana ese jugador, -1 es parda. */
export type TrickResult = Player | -1

export function compare(a: TrucoCard, b: TrucoCard): TrickResult {
  const d = rank(a) - rank(b)
  return d > 0 ? 0 : d < 0 ? 1 : -1
}

// ---------- Envido ----------

export type EnvidoCall = "envido" | "real" | "falta"

export const envidoValue = (c: TrucoCard): number => (c.num <= 7 ? c.num : 0)

export function envidoPoints(hand: readonly TrucoCard[]): number {
  let best = 0
  for (const suit of SUITS) {
    const vals = hand.filter((c) => c.suit === suit).map(envidoValue).sort((a, b) => b - a)
    if (vals.length >= 2) best = Math.max(best, 20 + vals[0] + vals[1])
  }
  for (const c of hand) best = Math.max(best, envidoValue(c))
  return best
}

export function envidoExplain(hand: readonly TrucoCard[]): string {
  for (const suit of SUITS) {
    const cs = hand.filter((c) => c.suit === suit).sort((a, b) => envidoValue(b) - envidoValue(a))
    if (cs.length >= 2) {
      const [a, b] = cs
      return `Dos de ${suit}: 20 + ${envidoValue(a)} + ${envidoValue(b)} = ${envidoPoints(hand)}`
    }
  }
  return `Ningún palo repetido: vale la carta más alta, ${envidoPoints(hand)}`
}

/** Puntos de flor (tres del mismo palo: 20 + las tres), o null si no hay flor. */
export function florPoints(hand: readonly TrucoCard[]): number | null {
  if (hand.length !== 3 || !hand.every((c) => c.suit === hand[0].suit)) return null
  return 20 + hand.reduce((t, c) => t + envidoValue(c), 0)
}

export type FlorCall = "flor" | "contraflor" | "resto"
export const FLOR_LABEL: Record<FlorCall, string> = { flor: "Flor", contraflor: "Contraflor", resto: "Contraflor al resto" }
/** Flor sin contraflor: 3. Contraflor querida: 6. Contraflor (o al resto) no querida: 4. */
export const FLOR_POINTS = { flor: 3, contraflor: 6, noQuerida: 4 } as const

export const ENVIDO_LABEL: Record<EnvidoCall, string> = { envido: "Envido", real: "Real envido", falta: "Falta envido" }
const ENVIDO_VAL: Record<Exclude<EnvidoCall, "falta">, number> = { envido: 2, real: 3 }

/** Falta envido: lo que le falta al que va ganando. */
export function faltaValue(score: readonly [number, number], target: number): number {
  return target - Math.max(score[0], score[1])
}

export function envidoQuerido(calls: readonly EnvidoCall[], score: readonly [number, number], target: number): number {
  if (calls.includes("falta")) return faltaValue(score, target)
  return calls.reduce((s, k) => s + ENVIDO_VAL[k as Exclude<EnvidoCall, "falta">], 0)
}

/** No querido: lo que valía antes del último canto, o 1 si era el primero. */
export function envidoNoQuerido(calls: readonly EnvidoCall[]): number {
  const prev = calls.slice(0, -1)
  if (!prev.length) return 1
  return prev.reduce((s, k) => s + ENVIDO_VAL[k as Exclude<EnvidoCall, "falta">], 0)
}

/** Qué se puede cantar encima de lo ya cantado. */
export function envidoRaises(calls: readonly EnvidoCall[]): EnvidoCall[] {
  if (!calls.length) return ["envido", "real", "falta"]
  const last = calls[calls.length - 1]
  const envidos = calls.filter((k) => k === "envido").length
  if (last === "envido") return envidos < 2 ? ["envido", "real", "falta"] : ["real", "falta"]
  if (last === "real") return ["falta"]
  return []
}

// ---------- Truco ----------

export type TrucoLevel = 0 | 1 | 2 | 3
export const TRUCO_LABEL = ["", "Truco", "Retruco", "Vale cuatro"] as const
/** Lo que vale la mano con ese nivel querido (0 = sin truco). */
export const trucoValue = (level: TrucoLevel): number => (level === 0 ? 1 : level + 1)

/**
 * Ganador de la mano a partir de los resultados de las bazas. null si todavía
 * no se sabe.
 */
export function handWinner(results: readonly TrickResult[], mano: Player): Player | null {
  const [r0, r1, r2] = results
  if (results.length < 2) return null
  if (results.length === 2) {
    if (r0 !== -1 && r0 === r1) return r0
    if (r0 === -1 && r1 !== -1) return r1
    if (r0 !== -1 && r1 === -1) return r0
    return null
  }
  if (r2 !== -1) return r2
  if (r0 !== -1) return r0
  return mano
}

// ---------- Partida ----------

export type LogKind = "info" | "play" | "call" | "explain" | "points" | "end"
export interface LogEntry {
  who: Player | null
  text: string
  kind: LogKind
  hand: number
}

export interface Trick {
  lead: Player
  cards: [TrucoCard | null, TrucoCard | null]
  winner: TrickResult | null
}

export type Pending =
  | { kind: "truco"; by: Player; level: 1 | 2 | 3 }
  | { kind: "envido"; by: Player }
  | { kind: "flor"; by: Player; call: FlorCall }

export interface HandState {
  /** Las tres cartas que recibió cada uno (para contar el envido). */
  dealt: [TrucoCard[], TrucoCard[]]
  /** Las que le quedan en la mano a cada uno. */
  cards: [TrucoCard[], TrucoCard[]]
  tricks: Trick[]
  turn: Player
  /** Nivel querido y quién puede subirlo (null = cualquiera, todavía no se cantó). */
  truco: { level: TrucoLevel; canRaise: Player | null }
  envido: { calls: EnvidoCall[]; done: boolean; points: [number, number] | null; winner: Player | null }
  /** Flor (solo en partidas con flor): quién la cantó, si terminó y, si se compararon, los puntos. */
  flor: { sung: [boolean, boolean]; done: boolean; points: [number, number] | null; winner: Player | null }
  pending: Pending | null
  /** Truco que quedó esperando respuesta mientras se resuelve el envido o la flor. */
  suspended: Pending | null
  over: boolean
  winner: Player | null
  points: number
}

export interface GameState {
  target: number
  /** Se juega con flor (las partidas guardadas de antes no lo tienen: sin flor). */
  flor?: boolean
  score: [number, number]
  mano: Player
  log: LogEntry[]
  over: boolean
  winner: Player | null
  hands: number
  hand: HandState
}

export type TrucoAction =
  | { type: "play"; index: number }
  | { type: "truco" }
  | { type: "envido"; call: EnvidoCall }
  | { type: "quiero" }
  | { type: "noQuiero" }
  | { type: "mazo" }
  | { type: "flor" }
  | { type: "contraflor" }
  | { type: "contraflorResto" }
  | { type: "achico" }

export interface Legal {
  play: boolean
  envido: EnvidoCall[]
  /** Nivel que se puede cantar (truco, retruco, vale cuatro), o null. */
  truco: 1 | 2 | 3 | null
  quiero: boolean
  noQuiero: boolean
  mazo: boolean
  /** Cantar flor, y contestar la flor del otro teniendo flor. */
  flor: boolean
  contraflor: boolean
  contraflorResto: boolean
  /** "Con flor me achico". */
  achico: boolean
}

const clone = <T,>(x: T): T => structuredClone(x)
const other = (p: Player): Player => (1 - p) as Player
const ORD = ["primera", "segunda", "tercera"]

function say(g: GameState, who: Player | null, text: string, kind: LogKind = "info") {
  g.log.push({ who, text, kind, hand: g.hands })
}

/** Partida nueva; `mano` es quien es mano en la primera. */
export function newGame(
  { target = 30, mano = 0, flor = false }: { target?: number; mano?: Player; flor?: boolean } = {},
  rng: Rng = Math.random,
): GameState {
  const g = {
    target,
    flor,
    score: [0, 0],
    mano: other(mano),
    log: [],
    over: false,
    winner: null,
    hands: 0,
  } as unknown as GameState
  return deal(g, rng)
}

/** Reparte la mano siguiente (el mano pasa al otro). */
export function dealHand(prev: GameState, rng: Rng = Math.random): GameState {
  if (prev.over) throw new Error("La partida terminó")
  return deal(clone(prev), rng)
}

function deal(g: GameState, rng: Rng): GameState {
  g.mano = other(g.mano)
  g.hands++
  const d = shuffle(deck(), rng)
  const pie = other(g.mano)
  const cards: [TrucoCard[], TrucoCard[]] = [[], []]
  for (let i = 0; i < 3; i++) {
    cards[pie].push(d[i * 2])
    cards[g.mano].push(d[i * 2 + 1])
  }
  g.hand = {
    dealt: [cards[0].slice(), cards[1].slice()],
    cards,
    tricks: [{ lead: g.mano, cards: [null, null], winner: null }],
    turn: g.mano,
    truco: { level: 0, canRaise: null },
    envido: { calls: [], done: false, points: null, winner: null },
    flor: { sung: [false, false], done: false, points: null, winner: null },
    pending: null,
    suspended: null,
    over: false,
    winner: null,
    points: 0,
  }
  say(g, null, `Mano ${g.hands}. ${g.mano === 0 ? "Sos mano: jugás primero." : "La máquina es mano: juega primero."}`, "info")
  return g
}

export const currentTrick = (g: GameState): Trick => g.hand.tricks[g.hand.tricks.length - 1]

/** A quién le toca hacer algo (null si la mano o la partida terminaron). */
export function actor(g: GameState): Player | null {
  if (g.over || g.hand.over) return null
  return g.hand.pending ? other(g.hand.pending.by) : g.hand.turn
}

/** Si `p` tiene flor en esta partida (con flor). */
export function hasFlor(g: GameState, p: Player): boolean {
  return !!g.flor && florPoints(g.hand.dealt[p]) !== null
}

/** Tiene flor y todavía no la cantó, en la primera baza antes de tirar: es lo único que puede hacer. */
function mustSingFlor(g: GameState, p: Player): boolean {
  const h = g.hand
  const f = h.flor ?? { sung: [false, false], done: false }
  return hasFlor(g, p) && !f.sung[p] && !f.done && h.tricks.length === 1 && !h.tricks[0].cards[p]
}

function canEnvido(g: GameState, p: Player): EnvidoCall[] {
  const h = g.hand
  const pd = h.pending
  if (h.envido.done || h.tricks.length > 1) return []
  // Con flor no hay envido: ni si la tenés vos ni si ya se cantó.
  if (g.flor && (hasFlor(g, p) || h.flor.sung[0] || h.flor.sung[1])) return []
  if (pd && pd.by === p) return []
  // Contestar un envido: se puede subir aunque ya hayas tirado tu carta.
  if (pd && pd.kind === "envido") return envidoRaises(h.envido.calls)
  if (h.tricks[0].cards[p]) return []
  // El envido va primero: al truco (no al retruco) se le contesta con envido.
  if (pd && pd.kind === "truco") return pd.level === 1 && !h.envido.calls.length ? envidoRaises([]) : []
  if (h.turn !== p || h.truco.level > 0 || h.envido.calls.length) return []
  return envidoRaises([])
}

export function legal(g: GameState, p: Player): Legal {
  const none: Legal = {
    play: false,
    envido: [],
    truco: null,
    quiero: false,
    noQuiero: false,
    mazo: false,
    flor: false,
    contraflor: false,
    contraflorResto: false,
    achico: false,
  }
  if (actor(g) !== p) return none
  const h = g.hand
  const pd = h.pending
  // Contestar la flor del otro (solo pasa si los dos tienen flor).
  if (pd && pd.kind === "flor") {
    if (pd.call === "flor") return { ...none, achico: true, contraflor: true, contraflorResto: true }
    if (pd.call === "contraflor") return { ...none, quiero: true, noQuiero: true, contraflorResto: true }
    return { ...none, quiero: true, noQuiero: true }
  }
  // Con flor sin cantar, lo primero es cantarla (también para contestar un envido o un truco).
  if (mustSingFlor(g, p)) return { ...none, flor: true }
  const out: Legal = { ...none, envido: canEnvido(g, p) }
  if (pd) {
    out.quiero = out.noQuiero = true
    if (pd.kind === "truco") {
      out.mazo = true
      if (pd.level < 3) out.truco = (pd.level + 1) as 2 | 3
    }
    return out
  }
  out.play = true
  out.mazo = true
  if (h.truco.level < 3 && (h.truco.canRaise === null || h.truco.canRaise === p)) {
    out.truco = (h.truco.level + 1) as 1 | 2 | 3
  }
  return out
}

/** Aplica una acción del jugador `p`. Tira un error si no es legal. */
export function act(prev: GameState, p: Player, action: TrucoAction): GameState {
  const l = legal(prev, p)
  const g = clone(prev)
  apply(g, p, action, l)
  return g
}

function apply(g: GameState, p: Player, action: TrucoAction, l: Legal): void {
  const h = g.hand
  const o = other(p)
  switch (action.type) {
    case "play": {
      if (!l.play) throw new Error("No podés jugar ahora")
      if (action.index < 0 || action.index >= h.cards[p].length) throw new Error("Esa carta no está")
      const card = h.cards[p].splice(action.index, 1)[0]
      const t = h.tricks[h.tricks.length - 1]
      t.cards[p] = card
      say(g, p, `Juega ${cardName(card)}.`, "play")
      if (!t.cards[o]) {
        h.turn = o
        return
      }
      const [c0, c1] = t.cards as [TrucoCard, TrucoCard]
      t.winner = compare(c0, c1)
      const ord = ORD[h.tricks.length - 1]
      if (t.winner === -1) {
        say(g, null, `Parda en ${ord}: ${cardName(c0)} y ${cardName(c1)} valen lo mismo.`, "explain")
      } else {
        const w = t.winner
        say(
          g,
          null,
          `${w === 0 ? "Ganás" : "La máquina gana"} la ${ord}: ${cardName(t.cards[w]!)} le gana a ${cardName(t.cards[other(w)]!)}.`,
          "explain",
        )
      }
      const res = h.tricks.map((x) => x.winner as TrickResult)
      const winner = handWinner(res, g.mano)
      if (winner !== null) {
        let why = ""
        if (res.length === 3 && res.every((r) => r === -1)) why = " (todas pardas: gana el mano)"
        else if (res[0] === -1) why = " (la primera fue parda: define la que sigue)"
        else if (res.includes(-1)) why = " (con una parda, gana quien ganó la primera)"
        endHand(g, winner, trucoValue(h.truco.level), why)
        return
      }
      // Gana la baza: tira primero en la siguiente. Si fue parda, el mano.
      const lead = t.winner === -1 ? g.mano : t.winner
      h.tricks.push({ lead, cards: [null, null], winner: null })
      h.turn = lead
      return
    }
    case "truco": {
      if (!l.truco) throw new Error("No podés cantar truco ahora")
      const raising = h.pending?.kind === "truco"
      if (raising) h.truco = { level: (h.pending as { level: TrucoLevel }).level, canRaise: p }
      h.pending = { kind: "truco", by: p, level: l.truco }
      const label = TRUCO_LABEL[l.truco]
      say(g, p, raising ? `¡Quiero ${label.toLowerCase()}!` : `¡${label}!`, "call")
      return
    }
    case "envido": {
      if (!l.envido.includes(action.call)) throw new Error("No podés cantar eso ahora")
      if (h.pending && h.pending.kind === "truco") {
        h.suspended = h.pending
        say(g, null, "El envido va primero: el truco queda esperando respuesta.", "explain")
      }
      h.envido.calls.push(action.call)
      h.pending = { kind: "envido", by: p }
      say(g, p, `¡${ENVIDO_LABEL[action.call]}!`, "call")
      return
    }
    case "quiero": {
      if (!l.quiero || !h.pending) throw new Error("No hay nada que querer")
      const pd = h.pending
      say(g, p, "Quiero.", "call")
      if (pd.kind === "flor") {
        resolveFlor(g, pd.call === "resto" ? faltaValue(g.score, g.target) : FLOR_POINTS.contraflor, pd.call)
      } else if (pd.kind === "truco") {
        h.truco = { level: pd.level, canRaise: p }
        h.pending = null
        say(
          g,
          null,
          `${TRUCO_LABEL[pd.level]} querido: la mano ahora vale ${trucoValue(pd.level)}. Solo quien quiso puede subir la apuesta.`,
          "explain",
        )
      } else {
        resolveEnvido(g)
      }
      return
    }
    case "noQuiero": {
      if (!l.noQuiero || !h.pending) throw new Error("No hay nada que rechazar")
      const pd = h.pending
      say(g, p, "No quiero.", "call")
      if (pd.kind === "flor") {
        h.flor.done = true
        h.pending = null
        say(g, null, `${FLOR_LABEL[pd.call]} no querida: ${pd.by === 0 ? "sumás" : "la máquina suma"} ${FLOR_POINTS.noQuerida}.`, "points")
        addScore(g, pd.by, FLOR_POINTS.noQuerida)
        resume(g)
      } else if (pd.kind === "truco") {
        const pts = pd.level === 1 ? 1 : trucoValue((pd.level - 1) as TrucoLevel)
        endHand(g, pd.by, pts, ` (${TRUCO_LABEL[pd.level].toLowerCase()} no querido)`)
      } else {
        const pts = envidoNoQuerido(h.envido.calls)
        h.envido.done = true
        say(g, null, `Envido no querido: ${pd.by === 0 ? "sumás" : "la máquina suma"} ${pts}.`, "points")
        addScore(g, pd.by, pts)
        resume(g)
      }
      return
    }
    case "flor": {
      if (!l.flor) throw new Error("No podés cantar flor ahora")
      if (h.pending?.kind === "envido") {
        h.envido = { ...h.envido, calls: [], done: true }
        say(g, null, "La flor anula el envido.", "explain")
      } else if (h.pending?.kind === "truco") {
        h.suspended = h.pending
        say(g, null, "La flor va primero: el truco queda esperando respuesta.", "explain")
      }
      h.pending = null
      h.envido.done = true
      h.flor.sung[p] = true
      say(g, p, "¡Flor!", "call")
      if (hasFlor(g, o)) {
        h.pending = { kind: "flor", by: p, call: "flor" }
        return
      }
      h.flor.done = true
      say(g, null, `Flor: ${p === 0 ? "sumás" : "la máquina suma"} ${FLOR_POINTS.flor}.`, "points")
      addScore(g, p, FLOR_POINTS.flor)
      resume(g)
      return
    }
    case "achico": {
      if (!l.achico || h.pending?.kind !== "flor") throw new Error("No hay flor que contestar")
      const by = h.pending.by
      h.flor.sung[p] = true
      say(g, p, "Con flor me achico.", "call")
      h.flor.done = true
      h.pending = null
      say(g, null, `${by === 0 ? "Sumás" : "La máquina suma"} ${FLOR_POINTS.flor} por la flor.`, "points")
      addScore(g, by, FLOR_POINTS.flor)
      resume(g)
      return
    }
    case "contraflor":
    case "contraflorResto": {
      const resto = action.type === "contraflorResto"
      if (!(resto ? l.contraflorResto : l.contraflor)) throw new Error("No podés cantar eso ahora")
      h.flor.sung[p] = true
      h.pending = { kind: "flor", by: p, call: resto ? "resto" : "contraflor" }
      say(g, p, resto ? "¡Contraflor al resto!" : "¡Contraflor!", "call")
      return
    }
    case "mazo": {
      if (!l.mazo) throw new Error("No podés irte al mazo ahora")
      if (h.pending) return apply(g, p, { type: "noQuiero" }, l)
      say(g, p, "Me voy al mazo.", "call")
      endHand(g, o, trucoValue(h.truco.level), " (se fue al mazo)")
      return
    }
  }
}

function resolveEnvido(g: GameState) {
  const h = g.hand
  const pts: [number, number] = [envidoPoints(h.dealt[0]), envidoPoints(h.dealt[1])]
  const m = g.mano
  const pie = other(m)
  say(g, m, `Tengo ${pts[m]}.`, "call")
  if (pts[pie] > pts[m]) say(g, pie, `${pts[pie]} son mejores.`, "call")
  else say(g, pie, pts[pie] === pts[m] ? `${pts[pie]}: empate, gana el mano. Son buenas.` : "Son buenas.", "call")
  const w = pts[pie] > pts[m] ? pie : m
  const val = envidoQuerido(h.envido.calls, g.score, g.target)
  h.envido = { ...h.envido, done: true, points: pts, winner: w }
  const sung = h.envido.calls.map((k) => ENVIDO_LABEL[k]).join(" + ")
  say(g, null, `${sung} querido: ${w === 0 ? "ganás" : "la máquina gana"} ${val} punto${val > 1 ? "s" : ""} con ${pts[w]}.`, "points")
  addScore(g, w, val)
  resume(g)
}

/** Contraflor querida: se dicen las flores (primero el mano) y el de más flor suma `val` (empate: el mano). */
function resolveFlor(g: GameState, val: number, call: FlorCall) {
  const h = g.hand
  const pts: [number, number] = [florPoints(h.dealt[0]) ?? 0, florPoints(h.dealt[1]) ?? 0]
  const m = g.mano
  const pie = other(m)
  say(g, m, `Tengo ${pts[m]} de flor.`, "call")
  if (pts[pie] > pts[m]) say(g, pie, `${pts[pie]} son mejores.`, "call")
  else say(g, pie, pts[pie] === pts[m] ? `${pts[pie]}: empate, gana el mano. Son buenas.` : "Son buenas.", "call")
  const w = pts[pie] > pts[m] ? pie : m
  h.flor = { ...h.flor, done: true, points: pts, winner: w }
  h.pending = null
  say(g, null, `${FLOR_LABEL[call]} querida: ${w === 0 ? "ganás" : "la máquina gana"} ${val} punto${val > 1 ? "s" : ""} con ${pts[w]}.`, "points")
  addScore(g, w, val)
  resume(g)
}

function resume(g: GameState) {
  const h = g.hand
  h.pending = h.suspended
  h.suspended = null
  if (h.pending && h.pending.kind === "truco" && !g.over) {
    say(g, null, `Ahora hay que contestar el ${TRUCO_LABEL[h.pending.level].toLowerCase()}.`, "explain")
  }
}

function addScore(g: GameState, p: Player, n: number) {
  g.score[p] = Math.min(g.target, g.score[p] + n)
  if (g.score[p] >= g.target && !g.over) {
    g.over = true
    g.winner = p
    g.hand.over = true
    g.hand.pending = null
    say(
      g,
      null,
      p === 0 ? `¡Ganaste la partida ${g.score[0]} a ${g.score[1]}!` : `La máquina gana la partida ${g.score[1]} a ${g.score[0]}.`,
      "end",
    )
  }
}

function endHand(g: GameState, winner: Player, pts: number, why = "") {
  const h = g.hand
  if (g.over) return
  h.over = true
  h.winner = winner
  h.points = pts
  h.pending = null
  say(g, null, `${winner === 0 ? "Ganaste" : "La máquina gana"} la mano${why}: ${pts} punto${pts > 1 ? "s" : ""}.`, "points")
  addScore(g, winner, pts)
}
