// Bots de "Mesa de práctica" (ver docs/plan-jugar-contra-bots.md).
//
// En general deciden como el ejercicio "Con luz": simulan su chance de ganar
// (equity) contra los que siguen en la mano, con cartas al azar (no ven las de
// nadie), y la comparan con lo que tienen que pagar (pot odds). Es una regla
// nuestra, sin fuente, medida con simulaciones (ver más abajo). Desde el
// 26/11/2026 ya no llevan la etiqueta Beta en la pantalla (se pidió sacarla).
//
// Excepción: con ciegas, en Hold'em Long y de 4 a 6 jugadores, antes del flop
// siguen los rangos de PokerStrategy que ya usa Entrenar (preflop.ts y
// preflop-vs.ts): abrir si nadie entró, y con 6, pagar o resubir contra una
// subida y contestar a una resubida. Con 4 o 5 se sacan las primeras
// posiciones, como en Entrenar (adaptación nuestra). Los tamaños de las
// subidas fuera de la apertura (3× la subida, 2,5× la resubida) son nuestros.
//
// Para que no sean 100% previsibles: a veces bluffean, a veces juegan lento una
// mano muy buena y el tamaño de la apuesta varía un poco.
//
// Niveles (BOT_PROFILES): fácil (paga todo, casi no bluffea), media, difícil
// (lee rangos, apuesta con proyectos, usa la posición) y Nano, el final boss,
// que además se adapta a cómo jugás vos en la sesión. Todo eso es nuestro;
// cuánto le gana cada nivel al otro está medido en
// scripts/lab/bot-levels.ts (resultados en docs/plan-jugar-contra-bots.md).

import { remainingDeck, type Card, type Rng } from "./cards"
import { bestScore } from "./evaluator"
import { act, canRequestCajita, legalActions, potTotal, type Action, type BettingStreet, type HandState, type Legal, type TableState } from "./table"
import { handClass, OPEN_RANGES, openRange, type Position } from "./preflop"
import { vsAction, vsSpots, type Seat6 } from "./preflop-vs"
import { BETA_DATA } from "./preflop-beta-data"
import { GAMES, type Variant } from "./variants"

/** Simulaciones por decisión: Manhattan cuesta más por mano, así que simula menos. */
export const BOT_TRIALS: Record<Variant["game"], number> = { holdem: 600, omaha: 300, manhattan: 160 }

/**
 * Chance de ganar con `hole` contra `opponents` manos al azar, con la mesa que
 * hay (lo que falta sale al azar). Los empates cuentan a partes iguales.
 */
export function estimateEquity(
  hole: readonly Card[],
  board: readonly Card[],
  v: Variant,
  opponents: number,
  trials: number,
  rng: Rng,
): number {
  if (opponents <= 0) return 1
  const holeCount = GAMES[v.game].holeCount
  const rest = remainingDeck(v.deck, [...hole, ...board])
  const needBoard = 5 - board.length
  const need = opponents * holeCount + needBoard
  const full = new Array<Card>(5)
  const opp = Array.from({ length: opponents }, () => new Array<Card>(holeCount))
  let eq = 0
  for (let t = 0; t < trials; t++) {
    for (let i = 0; i < need; i++) {
      const j = i + Math.floor(rng() * (rest.length - i))
      const tmp = rest[i]
      rest[i] = rest[j]
      rest[j] = tmp
    }
    let k = 0
    for (const o of opp) for (let i = 0; i < holeCount; i++) o[i] = rest[k++]
    for (let i = 0; i < board.length; i++) full[i] = board[i]
    for (let i = board.length; i < 5; i++) full[i] = rest[k++]
    const mine = bestScore(hole, full, v.game, v.deck)
    let ties = 1
    let lost = false
    for (const o of opp) {
      const s = bestScore(o, full, v.game, v.deck)
      if (s > mine) {
        lost = true
        break
      }
      if (s === mine) ties++
    }
    if (!lost) eq += 1 / ties
  }
  return eq / trials
}

// ── Leer rangos ─────────────────────────────────────────────────────────────
//
// Quien apuesta o sube no tiene una mano cualquiera. Para cada rival el bot
// arma "qué parte de las manos posibles le queda" (`keep`) según lo que hizo
// en la mano, y en la simulación le reparte solo manos de esa parte de arriba.
// Una parte de las veces (`bluffMix`) le da una mano cualquiera: así cuenta que
// a veces bluffean o apuestan con proyectos (lo que no se ve como mano hecha).
//
// Cómo se mide "la parte de arriba": antes del flop, en Hold'em, con la equity
// de cada mano contra 2 al azar (la misma tabla del "¿Abrís?" Beta); del flop
// en adelante, con la mano hecha que arma con la mesa. En Omaha y Manhattan no
// hay tabla antes del flop: ahí no se achica (se usa la cuenta de siempre).
// Los factores por acción (KEEP) son nuestros, sin fuente (medidos en el estudio de niveles).

/** Parte de las manos que le queda a un rival después de cada acción (antes de escalar por `reads`). */
export const KEEP = {
  preflopRaise: 0.35,
  preflopCall: 0.7,
  raise: 0.45,
  call: 0.7,
  /** Lo que mínimo le queda (nunca se lo da por una sola mano). */
  floor: 0.04,
}

export interface OpponentRange {
  /** Parte de las manos posibles que le quedan (1 = cualquiera). */
  keep: number
  /** Parte de las veces que se le da una mano cualquiera igual (bluffs, proyectos). */
  bluffMix: number
}

/** Cuánto vale una mano para ordenarlas en la calle actual, o null si no hay cómo. */
function strengthProxy(v: Variant, board: readonly Card[]): ((hand: readonly Card[]) => number) | null {
  if (board.length >= 3) return (hand) => bestScore(hand, board, v.game, v.deck)
  if (v.game !== "holdem") return null
  const grid: Record<string, number> = v.deck === "long" ? BETA_DATA.longGrid : BETA_DATA.shortGrid
  return (hand) => grid[handClass(hand[0], hand[1])] ?? 0
}

/** Manos de muestra por decisión para saber qué es "la parte de arriba". */
const POOL = 240

/**
 * Como `estimateEquity`, pero a cada rival le reparte manos de su rango
 * (`opps`). Con todos en "cualquiera" da lo mismo que `estimateEquity`.
 */
export function estimateRangeEquity(
  hole: readonly Card[],
  board: readonly Card[],
  v: Variant,
  opps: readonly OpponentRange[],
  trials: number,
  rng: Rng,
): number {
  if (opps.length === 0) return 1
  const proxy = strengthProxy(v, board)
  if (!proxy || opps.every((o) => o.keep >= 0.999 || o.bluffMix >= 0.999)) {
    return estimateEquity(hole, board, v, opps.length, trials, rng)
  }
  const holeCount = GAMES[v.game].holeCount
  const rest = remainingDeck(v.deck, [...hole, ...board])

  // Manos de muestra, ordenadas de mejor a peor.
  const pool: { cards: Card[]; s: number }[] = []
  for (let n = 0; n < POOL; n++) {
    for (let i = 0; i < holeCount; i++) {
      const j = i + Math.floor(rng() * (rest.length - i))
      const tmp = rest[i]
      rest[i] = rest[j]
      rest[j] = tmp
    }
    const cards = rest.slice(0, holeCount)
    pool.push({ cards, s: proxy(cards) })
  }
  pool.sort((a, b) => b.s - a.s)
  const eligible = opps.map((o) => {
    if (o.keep >= 0.999) return null
    const thr = pool[Math.min(POOL - 1, Math.floor(o.keep * POOL))].s
    return pool.filter((p) => p.s >= thr)
  })

  const used = new Uint8Array(64)
  let stamp = 0
  const full = new Array<Card>(5)
  const oppCards: (readonly Card[])[] = new Array(opps.length)
  const avail: Card[] = []
  let eq = 0
  for (let t = 0; t < trials; t++) {
    stamp = (stamp % 250) + 1
    if (stamp === 1) used.fill(0)
    // 1) Los rivales con rango, de su parte de arriba (sin chocar cartas).
    for (let o = 0; o < opps.length; o++) {
      oppCards[o] = []
      const el = eligible[o]
      if (!el || rng() < opps[o].bluffMix) continue
      for (let tries = 0; tries < 12; tries++) {
        const cand = el[Math.floor(rng() * el.length)].cards
        if (cand.every((c) => used[c] !== stamp)) {
          for (const c of cand) used[c] = stamp
          oppCards[o] = cand
          break
        }
      }
    }
    // 2) El resto (rivales sin rango y la mesa que falta) al azar.
    avail.length = 0
    for (const c of rest) if (used[c] !== stamp) avail.push(c)
    let k = 0
    const draw = () => {
      const j = k + Math.floor(rng() * (avail.length - k))
      const tmp = avail[k]
      avail[k] = avail[j]
      avail[j] = tmp
      return avail[k++]
    }
    for (let o = 0; o < opps.length; o++) {
      if (oppCards[o].length === 0) oppCards[o] = Array.from({ length: holeCount }, draw)
    }
    for (let i = 0; i < board.length; i++) full[i] = board[i]
    for (let i = board.length; i < 5; i++) full[i] = draw()

    const mine = bestScore(hole, full, v.game, v.deck)
    let ties = 1
    let lost = false
    for (const o of oppCards) {
      const s = bestScore(o, full, v.game, v.deck)
      if (s > mine) {
        lost = true
        break
      }
      if (s === mine) ties++
    }
    if (!lost) eq += 1 / ties
  }
  return eq / trials
}

/** Qué le queda a `seat` según lo que hizo en la mano: lo de esta calle pesa entero, lo de antes a medias. */
export function keepFor(h: HandState, seat: number): number {
  let keep = 1
  for (const x of h.log) {
    if (x.seat !== seat || x.action === "fold" || x.action === "check") continue
    const pre = x.street === "preflop"
    const aggressive = x.to !== undefined
    const f = aggressive ? (pre ? KEEP.preflopRaise : KEEP.raise) : pre ? KEEP.preflopCall : KEEP.call
    keep *= x.street === h.street ? f : Math.sqrt(f)
  }
  return Math.max(KEEP.floor, keep)
}

// ── Niveles ───────────────────────────────────────────────────────────────

/** Qué tan fuerte juega un bot. Nano es el "final boss" (se desbloquea en nivel 9). */
export type BotLevel = "facil" | "media" | "dificil" | "nano"

export interface BotProfile {
  /** Cuánto lee los rangos de quien apuesta: 0 nada (todos con cualquier mano), 1 todo. */
  reads: number
  /** Parte de las veces que igual le da al rival una mano cualquiera. */
  bluffMix: number
  /** Margen sobre las pot odds para pagar (negativo: paga de más). */
  callMargin: number
  /** Bluff sin chances cuando nadie apostó y quedan 1 o 2 rivales. */
  bluff: number
  /** Apostar con chances (proyecto) en el flop o el turn cuando nadie apostó. */
  semiBluff: number
  /** Con una mano muy buena, pasar o solo pagar en vez de apostar. */
  slowplay: number
  /** Fuerza (equity sobre su parte justa) para apostar por valor. */
  valueAt: number
  /** Fuerza para subir cuando le apuestan. */
  raiseAt: number
  /**
   * Tamaño de las apuestas. "pez": chico con manos medias y grande con monstruos
   * (se le lee la mano por el tamaño). "segun": más grande cuanto mejor la mano.
   * "parejo": el mismo tamaño con valor y con bluff (no se lo lee).
   */
  sizing: "pez" | "segun" | "parejo"
  /** Bluffea más con posición (habla último) y menos sin ella. */
  position: boolean
  /** Antes del flop con ciegas en Hold'em Long, sigue los rangos de PokerStrategy. */
  ranges: boolean
  /** Se adapta a cómo jugás vos en la sesión (solo Nano). */
  adapts: boolean
}

export const BOT_PROFILES: Record<BotLevel, BotProfile> = {
  // Pez: paga casi todo, casi nunca bluffea y apuesta solo con manos buenas.
  // La lección: apostale tus manos buenas y no lo bluffees.
  facil: { reads: 0, bluffMix: 1, callMargin: -0.08, bluff: 0.03, semiBluff: 0, slowplay: 0.3, valueAt: 1.7, raiseAt: 1.9, sizing: "pez", position: false, ranges: false, adapts: false },
  // Razonable: lee a medias lo que le apuestan y el tamaño sigue a la mano.
  media: { reads: 0.6, bluffMix: 0.25, callMargin: 0.02, bluff: 0.1, semiBluff: 0.15, slowplay: 0.15, valueAt: 1.5, raiseAt: 1.8, sizing: "segun", position: false, ranges: true, adapts: false },
  // Difícil: lee rangos, apuesta con proyectos, usa la posición y no se le lee el tamaño.
  dificil: { reads: 1, bluffMix: 0.12, callMargin: 0, bluff: 0.12, semiBluff: 0.15, slowplay: 0.12, valueAt: 1.35, raiseAt: 1.5, sizing: "parejo", position: true, ranges: true, adapts: false },
  // Nano: como difícil, y además te estudia durante la sesión.
  nano: { reads: 1, bluffMix: 0.12, callMargin: 0, bluff: 0.12, semiBluff: 0.15, slowplay: 0.12, valueAt: 1.35, raiseAt: 1.5, sizing: "parejo", position: true, ranges: true, adapts: true },
}

/** Compatibilidad: las frecuencias del bot de siempre (nivel media). */
export const BOT_STYLE = {
  bluff: BOT_PROFILES.media.bluff,
  slowplay: BOT_PROFILES.media.slowplay,
  callMargin: BOT_PROFILES.media.callMargin,
}

/** Apodos por nivel (personajes, no gente del grupo). Nano queda para el final boss. */
export const BOT_NAMES: Record<Exclude<BotLevel, "nano">, readonly string[]> = {
  facil: ["El Turista", "Doña Rosa", "El Optimista", "Pagador Serial", "El Curioso", "Tío Pocho", "La Esperanza"],
  media: ["El Contador", "La Profe", "El Ingeniero", "Rulo", "La Paciente", "El Gringo", "Toto"],
  dificil: ["La Calculadora", "El Mudo", "La Víbora", "El Frío", "Mister GTO", "La Esfinge", "El Relojero"],
}
export const NANO_NAME = "Nano"

/** Id de asiento de un bot: lleva su nivel, así la mesa guardada sabe cómo juega cada uno. */
export const botSeatId = (level: BotLevel, n: number) => (level === "nano" ? "nano" : `bot:${level}:${n}`)

/** Nivel de un asiento por su id (las mesas guardadas de antes, "bot1", juegan como media). */
export function botLevelOf(id: string): BotLevel {
  if (id === "nano") return "nano"
  const m = /^bot:(facil|media|dificil):/.exec(id)
  return m ? (m[1] as BotLevel) : "media"
}

/** Los bots de una mesa nueva: nombres al azar del nivel, y Nano en el primer asiento si se lo desafía. */
export function makeBots(level: Exclude<BotLevel, "nano">, count: number, nano: boolean, rng: Rng = Math.random) {
  const names = [...BOT_NAMES[level]]
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[names[i], names[j]] = [names[j], names[i]]
  }
  return Array.from({ length: count }, (_, i) =>
    nano && i === 0 ? { id: botSeatId("nano", 0), name: NANO_NAME } : { id: botSeatId(level, i + 1), name: names[i % names.length] },
  )
}

// ── Lo que Nano aprende de vos ───────────────────────────────────────────────

/**
 * Cómo viene jugando alguien en la sesión (lo usa Nano para adaptarse). Solo
 * cuenta lo que vería un jugador en la mesa: lo que hizo y las cartas que
 * mostró al final.
 */
export interface PlayerReads {
  /** Manos contadas (la última, para no contar dos veces la misma). */
  hands: number
  lastHand: number
  /** Veces que le apostaron y cuántas se fue. */
  facedBet: number
  foldedToBet: number
  /** Veces que apostó en el river y llegó a mostrar, y cuántas de esas perdió (era bluff o se pasó de valor). */
  shownBets: number
  shownBluffs: number
}

export const EMPTY_READS: PlayerReads = { hands: 0, lastHand: 0, facedBet: 0, foldedToBet: 0, shownBets: 0, shownBluffs: 0 }

/** Suma lo que hizo `seat` en una mano terminada. */
export function addHandToReads(r: PlayerReads, h: HandState, seat: number, structure: TableState["config"]["structure"]): PlayerReads {
  if (h.number === r.lastHand || !h.result) return r
  // Con luz se puede no entrar a la mano: esa no cuenta.
  if (!h.players.some((p) => p.seat === seat)) return { ...r, lastHand: h.number }
  const out = { ...r, hands: r.hands + 1, lastHand: h.number }
  const betOn = new Set<string>()
  if (structure === "ciegas") betOn.add("preflop") // la grande ya es una apuesta
  for (const x of h.log) {
    if (x.seat === seat && betOn.has(x.street) && x.action !== "check") {
      out.facedBet++
      if (x.action === "fold") out.foldedToBet++
    }
    if (x.to !== undefined) betOn.add(x.street)
  }
  // ¿Fue el último en apostar en el river y se vieron las cartas?
  const riverAggro = h.log.filter((x) => x.street === "river" && x.to !== undefined).at(-1)
  const me = h.players.find((p) => p.seat === seat)
  if (h.result.showdown && riverAggro?.seat === seat && me && !me.folded) {
    out.shownBets++
    const won = h.result.pots.some((p) => p.eligible.length > 1 && p.winners.includes(seat))
    if (!won) out.shownBluffs++
  }
  return out
}

/** Qué tan seguido se va "un jugador normal" cuando le apuestan (para los rivales que Nano no conoce). */
const NEUTRAL_FOLD = 0.45

/** Muestras mínimas antes de sacar conclusiones. */
export const READS_MIN = { facedBet: 6, shownBets: 3 }

/** Lo que Nano saca en limpio de alguien (null mientras no lo vio lo suficiente). */
export function exploitOf(r: PlayerReads | undefined) {
  if (!r) return null
  const foldRate = r.facedBet >= READS_MIN.facedBet ? r.foldedToBet / r.facedBet : null
  const bluffRate = r.shownBets >= READS_MIN.shownBets ? r.shownBluffs / r.shownBets : null
  if (foldRate === null && bluffRate === null) return null
  return { foldRate, bluffRate }
}

// ── La decisión ─────────────────────────────────────────────────────────────

export interface Situation {
  legal: Legal
  /** Pozo total (lo que puso cada uno en la mano). */
  pot: number
  /** Rivales que siguen en la mano. */
  opponents: number
  equity: number
  chip: number
  /** Calle (por defecto, como antes: sin distinguir). */
  street?: BettingStreet
  /** Habla último en la calle. */
  inPosition?: boolean
  /** Lo que Nano sabe de los rivales (el que menos se va cuando le apuestan). */
  exploit?: ReturnType<typeof exploitOf>
}

export interface BotDecision {
  action: Action
  /** Equity simulada (NaN si decidió por rango). */
  equity: number
  /** De dónde sale la decisión: rangos de PokerStrategy o nuestra cuenta. */
  source: "pokerstrategy" | "equity"
  /** Explicación corta, para mostrar o para los tests. */
  reason: string
}

/** Redondea a la ficha y lo deja entre lo mínimo y el all-in. */
function sizeTo(legal: Legal, target: number, chip: number): number {
  const rounded = Math.round(target / chip) * chip
  const to = Math.max(legal.minTo, Math.min(legal.maxTo, rounded))
  // Si queda casi todo, mejor all-in.
  return to >= legal.maxTo * 0.8 ? legal.maxTo : to
}

/** Mano "monstruo": 85% de ganar o más, o 2,5 veces su parte justa (con muchos rivales). */
const isMonster = (equity: number, strength: number) => equity >= 0.85 || strength >= 2.5

/** Parte del pozo que apuesta, según el estilo y si es valor o bluff. */
function betFraction(p: BotProfile, equity: number, strength: number, bluff: boolean, street: BettingStreet | undefined, rng: Rng): number {
  switch (p.sizing) {
    case "pez":
      // Se lee: chico con lo que no es monstruo (y con el bluff), grande con el monstruo.
      return !bluff && isMonster(equity, strength) ? 0.9 + rng() * 0.2 : 0.3 + rng() * 0.1
    case "segun":
      return bluff ? 0.5 : 0.45 + Math.min(0.45, (strength - 1) * 0.25) + (rng() - 0.5) * 0.1
    case "parejo":
      // Igual con valor y con bluff; en el river, más grande.
      return (street === "river" ? 0.7 : 0.55) + (rng() - 0.5) * 0.06
  }
}

/** La decisión a partir de la equity ya calculada (separada para poder testearla). */
export function decide(s: Situation, rng: Rng, profile: BotProfile = BOT_PROFILES.media): BotDecision {
  const { legal, pot, opponents, equity, chip, street } = s
  const fair = 1 / (opponents + 1) // lo que le tocaría "por partes iguales"
  const strength = equity / fair // 1 = normal; 2 = el doble de lo que le toca
  const pct = `${Math.round(equity * 100)}%`
  const ex = profile.adapts ? s.exploit : null
  const fold = ex?.foldRate ?? null
  // Nano: si te vas mucho cuando te apuestan, te bluffea más; si pagás todo, casi no te bluffea y te apuesta más fino.
  const bluffScale =
    (fold !== null ? (fold > 0.55 ? 2.5 : fold < 0.3 ? 0.3 : 1) : 1) *
    (profile.position && s.inPosition !== undefined ? (s.inPosition ? 1.4 : 0.7) : 1)
  const valueAt = profile.valueAt - (fold !== null && fold < 0.3 ? 0.2 : 0)
  const why = (base: string) =>
    ex && fold !== null && (fold > 0.55 || fold < 0.3)
      ? `${base} (te vio irte el ${Math.round(fold * 100)}% de las veces que te apostaron)`
      : base
  // Nano: al que paga todo le apuesta más grande con lo bueno (igual paga); al que se va mucho lo bluffea más barato.
  const sizeScale = (bluff: boolean) => (fold === null ? 1 : !bluff && fold < 0.3 ? 1.6 : bluff && fold > 0.55 ? 0.7 : 1)
  const bet = (bluff: boolean) => ({
    type: "raise" as const,
    to: sizeTo(legal, pot * betFraction(profile, equity, strength, bluff, street, rng) * sizeScale(bluff), chip),
  })

  if (legal.canCheck) {
    // Nadie le apostó: pasar es gratis, así que nunca se retira.
    const strong = strength >= valueAt && equity >= 0.3
    if (legal.canRaise && strong) {
      if (isMonster(equity, strength) && rng() < profile.slowplay) {
        return { action: { type: "check" }, equity, source: "equity", reason: `Pasó con una mano muy buena (${pct} de ganar) para disimular` }
      }
      return { action: bet(false), equity, source: "equity", reason: why(`Apostó: tenía ${pct} de ganar`) }
    }
    // Con chances (proyecto) en el flop o el turn: apuesta para que se vayan o para ganar si liga.
    if (legal.canRaise && opponents <= 2 && street && street !== "river" && street !== "preflop" && strength >= 0.7 && rng() < profile.semiBluff * bluffScale) {
      return { action: bet(true), equity, source: "equity", reason: why(`Apostó con chances: tenía ${pct} de ganar y además puede hacer que te vayas`) }
    }
    const bluffable = street === "river" ? strength < 0.5 : strength < 0.7 || !street
    if (legal.canRaise && opponents <= 2 && bluffable && rng() < profile.bluff * bluffScale) {
      return { action: bet(true), equity, source: "equity", reason: why(`Apostó de bluff: tenía solo ${pct} de ganar`) }
    }
    return { action: { type: "check" }, equity, source: "equity", reason: `Pasó: tenía ${pct} de ganar, no le daba para apostar` }
  }

  // Le apostaron: ¿le alcanza para pagar?
  const needed = legal.toCall / (pot + legal.toCall)
  if (equity < needed + profile.callMargin) {
    return { action: { type: "fold" }, equity, source: "equity", reason: `Se fue: tenía ${pct} de ganar y para pagar necesitaba ${Math.round(needed * 100)}%` }
  }
  // Muy por encima de lo que necesita: sube (o a veces solo paga para disimular).
  if (legal.canRaise && strength >= profile.raiseAt && equity >= needed + 0.2 && rng() >= profile.slowplay) {
    const frac = profile.sizing === "parejo" ? 0.6 : 0.4 + rng() * 0.4
    return { action: { type: "raise", to: sizeTo(legal, legal.minTo + (pot + legal.toCall) * frac, chip) }, equity, source: "equity", reason: `Subió: tenía ${pct} de ganar, mucho más de lo que necesitaba` }
  }
  return { action: { type: "call" }, equity, source: "equity", reason: `Pagó: tenía ${pct} de ganar y le alcanzaba con ${Math.round(needed * 100)}%` }
}

/**
 * Posición de cada asiento antes del flop con ciegas, de 4 a 6 jugadores (como
 * en Entrenar: con menos de 6 se sacan las primeras). null si no aplica.
 * `players` arranca a la izquierda del botón: chica, grande, …, botón.
 */
export function seatPositions(h: HandState): Map<number, Seat6> | null {
  const n = h.players.length
  if (n < 4 || n > 6) return null
  const rest: Seat6[] = n === 6 ? ["UTG", "MP", "CO", "BU"] : n === 5 ? ["MP", "CO", "BU"] : ["CO", "BU"]
  const names: Seat6[] = ["SB", "BB", ...rest]
  return new Map(h.players.map((p, i) => [p.seat, names[i]]))
}

/** Antes del flop con ciegas en Hold'em Long: lo que dicen los rangos de PokerStrategy, o null si no hay rango para la situación. */
export function rangeDecision(t: TableState, legal: Legal): BotDecision | null {
  const h = t.hand!
  const c = t.config
  if (c.structure !== "ciegas" || h.street !== "preflop" || h.variant.game !== "holdem" || h.variant.deck !== "long") return null
  const pos = seatPositions(h)
  if (!pos) return null
  const me = h.players.find((p) => p.seat === legal.seat)!
  const mine = pos.get(me.seat)!
  const big = c.blinds.big
  const log = h.log.filter((x) => x.street === "preflop")
  // Subidas: tienen `to`. Pagos: call o all-in sin `to`.
  const raises = log.filter((x) => x.to !== undefined)
  const callsBefore = (i: number) => log.slice(0, i < 0 ? log.length : i).filter((x) => x.to === undefined && x.action !== "fold" && x.action !== "check")
  const myActs = log.filter((x) => x.seat === me.seat)
  const out = (type: "fold" | "call" | "raise", to: number, reason: string): BotDecision => {
    let action: Action
    if (type === "raise" && legal.canRaise) action = { type: "raise", to: sizeTo(legal, to, c.chip) }
    else if (type === "fold") action = legal.canCheck ? { type: "check" } : { type: "fold" }
    else action = legal.toCall === 0 ? { type: "check" } : { type: "call" }
    return { action, equity: NaN, source: "pokerstrategy", reason }
  }
  const cls = handClass(me.hole[0], me.hole[1])

  // Nadie entró antes: abrir o no (la grande no abre: ya puso).
  if (raises.length === 0 && callsBefore(-1).length === 0 && mine !== "BB") {
    const p = mine as Position
    if (!openRange(p).has(cls)) return out("fold", 0, `No abrió ${cls} desde ${mine}: no está en el rango de PokerStrategy`)
    const size = Number(OPEN_RANGES[p].openSize.replace(",", "."))
    return out("raise", size * big, `Abrió ${cls} desde ${mine}: está en el rango de PokerStrategy`)
  }
  // Las situaciones contra una subida son solo de mesas de 6.
  if (h.players.length !== 6) return null
  // Una subida, nadie pagó en el medio y todavía no hablé: pagar, resubir o fold.
  if (raises.length === 1 && myActs.length === 0) {
    const r = raises[0]
    const idx = log.indexOf(r)
    if (callsBefore(idx).length > 0 || log.slice(idx + 1).some((x) => x.action !== "fold")) return null
    const spot = vsSpots().find((s) => s.kind === "vsOpen" && s.hero === mine && s.villain === pos.get(r.seat))
    if (!spot) return null
    const a = vsAction(spot, me.hole)
    return out(a, 3 * r.to!, `${a === "raise" ? "Resubió" : a === "call" ? "Pagó" : "Se fue"} con ${cls} contra la subida de ${spot.villain}, como dice PokerStrategy`)
  }
  // Abrí, me resubieron y nadie más entró: contestar a la resubida.
  if (raises.length === 2 && raises[0].seat === me.seat && myActs.length === 1) {
    const r = raises[1]
    const idx = log.indexOf(r)
    if (log.slice(log.indexOf(raises[0]) + 1).some((x) => x !== r && x.action !== "fold")) return null
    const spot = vsSpots().find((s) => s.kind === "vs3bet" && s.hero === mine && s.villain === pos.get(r.seat))
    if (!spot || idx < 0) return null
    const a = vsAction(spot, me.hole)
    return out(a, 2.5 * r.to!, `${a === "raise" ? "Volvió a subir" : a === "call" ? "Pagó" : "Se fue"} con ${cls} contra la resubida de ${spot.villain}, como dice PokerStrategy`)
  }
  return null
}

/** ¿`seat` habla último en esta calle? (entre los que siguen y no están all-in) */
function lastToAct(h: HandState, seat: number): boolean {
  const live = h.players.filter((p) => !p.folded && !p.allIn)
  return live.length > 0 && live[live.length - 1].seat === seat
}

/** Opciones de la decisión: cuántas simulaciones y lo que se sabe de cada asiento. */
export interface BotOptions {
  trials?: number
  /** Cómo viene jugando cada asiento en la sesión (Nano lo usa con el tuyo). */
  reads?: Record<number, PlayerReads>
}

/** Lo que hace el bot al que le toca hablar. */
export function botDecide(t: TableState, rng: Rng = Math.random, opts: number | BotOptions = {}): BotDecision {
  const o: BotOptions = typeof opts === "number" ? { trials: opts } : opts
  const h = t.hand
  const legal = legalActions(t)
  if (!h || !legal) throw new Error("No le toca hablar a nadie")
  const level = botLevelOf(t.seats[legal.seat].id)
  const profile = BOT_PROFILES[level]
  if (profile.ranges) {
    const byRange = rangeDecision(t, legal)
    if (byRange) return byRange
  }
  const me = h.players.find((p) => p.seat === legal.seat)!
  const rivals = h.players.filter((p) => !p.folded && p.seat !== me.seat)
  // Nano: importa el rival que menos se va (para un bluff se tienen que ir todos; para
  // apostar grande alcanza con uno que pague). A quien no conoce lo toma como normal.
  let exploit: Situation["exploit"] = null
  if (profile.adapts) {
    const folds = rivals.map((p) => exploitOf(o.reads?.[p.seat])?.foldRate ?? null)
    if (folds.some((f) => f !== null)) exploit = { foldRate: Math.min(...folds.map((f) => f ?? NEUTRAL_FOLD)), bluffRate: null }
  }
  const ranges: OpponentRange[] = rivals.map((p) => {
    let bluffMix = profile.bluffMix
    // Nano: a quien vio bluffear al mostrar le cree menos; a quien siempre mostró la buena, más.
    const r = profile.adapts ? exploitOf(o.reads?.[p.seat]) : null
    if (r?.bluffRate != null && h.street === "river") bluffMix = Math.max(0.04, Math.min(0.5, r.bluffRate))
    return { keep: Math.pow(keepFor(h, p.seat), profile.reads), bluffMix }
  })
  const trials = o.trials ?? BOT_TRIALS[h.variant.game]
  const equity = estimateRangeEquity(me.hole, h.board, h.variant, ranges, trials, rng)
  return decide(
    { legal, pot: potTotal(h), opponents: rivals.length, equity, chip: t.config.chip, street: h.street, inPosition: h.street === "preflop" ? undefined : lastToAct(h, me.seat), exploit },
    rng,
    profile,
  )
}

/** Juega por el bot que habla y devuelve la mesa nueva. */
export function botAct(t: TableState, rng: Rng = Math.random, opts: number | BotOptions = {}): { table: TableState; decision: BotDecision } {
  const decision = botDecide(t, rng, opts)
  return { table: act(t, decision.action), decision }
}

/** Los bots piden otra cajita solo cuando se quedan sin fichas. */
export function botWantsCajita(t: TableState, seat: number): boolean {
  return t.seats[seat].stack === 0 && canRequestCajita(t, seat)
}
