// Cuentas de valor esperado (EV) que no dependen del juego ni del mazo: valen
// igual en Hold'em, Omaha y Manhattan. Las ideas vienen del libro "Daily Dose
// of GTO" (GTO Wizard, 2024); las preguntas y los números son nuestros.
//
// Todo se mide "desde ahora": lo que ya está en el pozo no es de nadie, así
// que hacer fold (o pasar sin ganar) vale 0 y ganar el pozo vale el pozo.
//
// 1. ¿Apostar o pasar? (river, el rival pasó)
//    Pasar:   EV = e_pasar × P
//    Apostar: EV = fold × P + call × (e_call × (P + 2B) − B) − raise × B
//             (si te sube, foldeás y perdés la apuesta)
//
// 2. Defensa contra bluffs que no son puros. Si el bluff del rival, en vez de
//    apostar, pasara y se llevara en promedio s × P, y cuando lo pagás gana una
//    parte q del pozo final, le da lo mismo apostar que pasar cuando seguís con
//         c = (1 − s) × P / (P + B − q × (P + 2B))
//    Con s = q = 0 es la defensa mínima de siempre, P / (P + B).
//
// 3. All-in con pocas fichas (con luz). Pozo P (las luces), te quedan A fichas.
//    Si nadie paga ganás P; si paga uno (chance c) jugás por P + 2A:
//         EV = (1 − c) × P + c × (w × (P + 2A) − A)
//    Lo que necesitás ganar cuando te pagan: w = (c × A − (1 − c) × P) / (c × (P + 2A))

import type { Rng } from "./cards"
import type { Variant } from "./variants"
import { GTO_SIZES, mdf } from "./gto"
import { LUZ } from "./drills"

const pick = <T,>(xs: readonly T[], rng: Rng): T => xs[Math.floor(rng() * xs.length)]
/** Entero al azar entre min y max (inclusive) en pasos de `step`. */
const stepInt = (min: number, max: number, step: number, rng: Rng) =>
  min + step * Math.floor(rng() * (Math.floor((max - min) / step) + 1))

/** 4 porcentajes enteros distintos (separados por al menos `gap`), con la respuesta y las confusiones típicas. */
function percentOptions(answer: number, related: number[], rng: Rng, gap = 4): number[] {
  const opts = [answer]
  const ok = (x: number) => x > 0 && x < 100 && opts.every((o) => Math.abs(o - x) >= gap)
  for (const r of related) if (opts.length < 4 && ok(r)) opts.push(r)
  const spread = [-20, -15, -10, -8, 8, 10, 15, 20]
  for (let tries = 0; opts.length < 4 && tries < 100; tries++) {
    const x = answer + pick(spread, rng)
    if (ok(x)) opts.push(x)
  }
  return opts.sort((a, b) => a - b)
}

// ── 1. ¿Apostar o pasar? ────────────────────────────────────────────────────

export interface BetOrCheckDrill {
  kind: "betOrCheck"
  pot: number
  bet: number
  sizeName: string
  /** Todo contado "de cada 10 veces", en enteros. Pasando: cuántas ganás el showdown. */
  checkWins: number
  /** Apostando: cuántas foldea, cuántas paga (y ganás / perdés) y cuántas te sube (y foldeás). Suman 10. */
  folds: number
  callWins: number
  callLosses: number
  raises: number
  /** Lo mismo en partes (0–1), para las fórmulas. */
  fold: number
  call: number
  raise: number
  eqCheck: number
  eqCall: number
  /** Promedio por mano (total de las 10 ÷ 10). */
  evCheck: number
  evBet: number
  shouldBet: boolean
}

export const evCheck = (pot: number, eqCheck: number) => eqCheck * pot
export function evBet(d: Pick<BetOrCheckDrill, "pot" | "bet" | "fold" | "call" | "raise" | "eqCall">) {
  return d.fold * d.pot + d.call * (d.eqCall * (d.pot + 2 * d.bet) - d.bet) - d.raise * d.bet
}

/** Diferencia mínima entre las dos opciones (parte del pozo): más cerca sería adivinar. */
export const BET_OR_CHECK_GAP = 0.05
const BET_OR_CHECK_KEEP_CHECK = 0.14
const BET_OR_CHECK_KEEP_OBVIOUS = 0.2

export function makeBetOrCheck(_v: Variant, rng: Rng = Math.random): BetOrCheckDrill {
  // Hasta el pozo: es una decisión de valor fino, no de overbet.
  const sizes = GTO_SIZES.filter((s) => s.frac <= 1)
  let d: BetOrCheckDrill | null = null
  for (let tries = 0; tries < 400; tries++) {
    const size = pick(sizes, rng)
    const pot = (1 + Math.floor(rng() * 5)) * 1200
    const bet = pot * size.frac
    const raises = stepInt(0, 2, 1, rng)
    const folds = stepInt(1, 9 - raises, 1, rng)
    const calls = 10 - folds - raises
    const checkWins = stepInt(4, 9, 1, rng)
    // Cuando te pagan estás peor que en el showdown sin apostar: pagan las mejores.
    const callWins = stepInt(0, calls, 1, rng)
    if (callWins / calls > checkWins / 10 - 0.1) continue
    const callLosses = calls - callWins
    const base = { pot, bet, fold: folds / 10, call: calls / 10, raise: raises / 10, eqCall: callWins / calls }
    const ec = (checkWins * pot) / 10
    const eb = (folds * pot + callWins * (pot + bet) - callLosses * bet - raises * bet) / 10
    d = {
      kind: "betOrCheck",
      ...base,
      sizeName: size.name,
      checkWins,
      folds,
      callWins,
      callLosses,
      raises,
      eqCheck: checkWins / 10,
      evCheck: ec,
      evBet: eb,
      shouldBet: eb > ec,
    }
    // Y al menos $200: los botones muestran el promedio redondeado a $100.
    if (Math.abs(eb - ec) < Math.max(BET_OR_CHECK_GAP * pot, 200)) continue
    // Al azar, pasar gana la mayoría: se descartan muchos para que apostar y
    // pasar salgan parecido (si no, se aprende a tocar siempre pasar).
    if (!d.shouldBet && rng() > BET_OR_CHECK_KEEP_CHECK) continue
    // Y "apuesto si foldea mucho" no tiene que alcanzar: hay que hacer la cuenta.
    if (d.shouldBet === d.fold > 0.5 && rng() > BET_OR_CHECK_KEEP_OBVIOUS) continue
    break
  }
  return d!
}

// ── 2. Defensa contra bluffs con chances (river) ───────────────────────────
// Contado "de tus 100 manos": contra un bluff puro pagás con la defensa mínima.
// Si su bluff, pasando, le ganaría a algunas de tus manos en el showdown, esas
// no sirven para pagar (pierden igual): la defensa se aplica sobre las demás.

export interface SemiBluffDrill {
  kind: "semiBluff"
  street: "river"
  pot: number
  /** All-in del rival: no se puede subir. */
  bet: number
  sizeName: string
  /** De tus 100 manos, a cuántas les ganaría su bluff si pasara. */
  beaten: number
  /** Parte del pozo que su bluff se llevaría pasando (beaten ÷ 100). */
  checkShare: number
  /** Defensa mínima de siempre (0–1) y en manos de 100. */
  plainMdf: number
  plainCount: number
  /** Las que cuentan: 100 − beaten. */
  counted: number
  /** Parte de tus manos con la que hay que seguir (0–1); la respuesta en manos de 100. */
  defend: number
  options: number[]
  answer: number
}

export function semiBluffDefense(pot: number, bet: number, checkShare: number, drawEquity: number) {
  return ((1 - checkShare) * pot) / (pot + bet - drawEquity * (pot + 2 * bet))
}

/** Tamaños con defensa mínima entera (75, 60, 50, 40 de 100): la cuenta sale de cabeza. */
const SEMI_BLUFF_SIZES = GTO_SIZES.filter((s) => Number.isInteger(100 / (1 + s.frac)))

export function makeSemiBluff(_v: Variant, rng: Rng = Math.random): SemiBluffDrill {
  let d: SemiBluffDrill | null = null
  for (let tries = 0; tries < 200; tries++) {
    const size = pick(SEMI_BLUFF_SIZES, rng)
    const pot = (1 + Math.floor(rng() * 5)) * 1200
    const bet = pot * size.frac
    const beaten = stepInt(10, 30, 5, rng)
    const counted = 100 - beaten
    const plain = mdf(pot, bet)
    const plainCount = Math.round(plain * 100)
    // Que el resultado sea entero: si no, la cuenta no sale de cabeza.
    if ((counted * plainCount) % 100 !== 0) continue
    const answer = (counted * plainCount) / 100
    // Confusiones típicas: la defensa de siempre y restarle las que pierden.
    const related = [plainCount, plainCount - beaten]
    d = {
      kind: "semiBluff",
      street: "river",
      pot,
      bet,
      sizeName: size.name,
      beaten,
      checkShare: beaten / 100,
      plainMdf: plain,
      plainCount,
      counted,
      defend: semiBluffDefense(pot, bet, beaten / 100, 0),
      options: percentOptions(answer, related, rng),
      answer,
    }
    break
  }
  return d!
}

// ── 3. All-in con pocas fichas ─────────────────────────────────────────────

export interface ShoveDrill {
  kind: "shove"
  players: number
  luz: number
  /** Pozo: la luz de todos. */
  pot: number
  /** Tus fichas además de la luz (lo que mandás all-in). */
  stack: number
  /** De cada 10 all-ins, cuántas veces te paga uno (el resto foldean todos). */
  calls: number
  /** De esas `calls` veces, cuántas ganás. */
  wins: number
  /** Lo que ganás (o perdés) en total en 10 all-ins. Fold vale 0. */
  total: number
  /** Promedio por all-in (total ÷ 10). */
  ev: number
  shouldShove: boolean
}

/** Lo que tenés que ganar cuando te pagan para que el all-in empate con el fold. */
export function shoveNeeded(pot: number, stack: number, callChance: number) {
  return (callChance * stack - (1 - callChance) * pot) / (callChance * (pot + 2 * stack))
}
export const shoveEv = (pot: number, stack: number, callChance: number, equity: number) =>
  (1 - callChance) * pot + callChance * (equity * (pot + 2 * stack) - stack)

/**
 * Todo contado "de cada 10 all-ins", con números enteros, para que se pueda
 * sumar de cabeza: las veces que foldean todos ganás las luces; cuando te paga
 * uno, ganás las luces y sus fichas o perdés las tuyas.
 */
export function makeShove(_v: Variant, rng: Rng = Math.random): ShoveDrill {
  let d: ShoveDrill | null = null
  for (let tries = 0; tries < 200; tries++) {
    const players = 4 + Math.floor(rng() * 3)
    const pot = players * LUZ
    const stack = stepInt(300, 2000, 100, rng)
    const calls = stepInt(2, 7, 1, rng)
    const wins = stepInt(1, calls - 1, 1, rng)
    const total = (10 - calls) * pot + wins * (pot + stack) - (calls - wins) * stack
    // El botón muestra el promedio redondeado a $100: que no diga "≈ $0".
    if (Math.abs(total) < 500) continue
    d = { kind: "shove", players, luz: LUZ, pot, stack, calls, wins, total, ev: total / 10, shouldShove: total > 0 }
    // Al azar, 9 de cada 10 dan all-in: se descartan la mayoría para que
    // all-in y fold salgan parecido (si no, se aprende a tocar siempre all-in).
    if (!d.shouldShove || rng() < 0.12) break
  }
  return d!
}

// ── 4. ¿Qué le queda? (tres apuestas seguidas) ──────────────────────────────
// Lecciones 210 y 325: si apostás en flop, turn y river y el rival paga cada
// vez justo su defensa mínima (P / (P + B) = 1 / (1 + tamaño)), lo que llega al
// river es lo que queda calle por calle. Contado "de 100 manos" y redondeando
// en cada calle, para que se pueda seguir de cabeza. Las manos que nunca
// foldea (por ejemplo los colores ya hechos) siguen siendo las mismas, así que
// pasan a ser una parte mucho mayor de lo que queda.

export type CallDownQuestion = "left" | "strong"

export interface CallDownDrill {
  kind: "callDown"
  question: CallDownQuestion
  /** Tamaño de cada apuesta como fracción del pozo, y cómo se dice. */
  sizes: { frac: number; name: string }[]
  /** Contra cada apuesta, con cuántas de cada 100 sigue (75, 67, 60, 50, 40). */
  defends: number[]
  /** Manos que siguen después del flop, del turn y del river (de 100 al flop). */
  chain: number[]
  /** Manos que llegan al river pagando todo (= chain[2]). */
  left: number
  /** Solo en "strong": de las 100 del flop, cuántas nunca foldean. */
  strong?: number
  options: number[]
  answer: number
}

/** Con cuántas de cada 100 sigue contra una apuesta de ese tamaño: su defensa mínima. */
export const defendPer100 = (frac: number) => Math.round(100 / (1 + frac))

/** Lo que queda calle por calle, redondeando cada vez (de 100 al flop). */
export function callDownChain(fracs: readonly number[]): number[] {
  const out: number[] = []
  let n = 100
  for (const f of fracs) {
    n = Math.round((n * defendPer100(f)) / 100)
    out.push(n)
  }
  return out
}

/** Lo que queda de su rango si paga justo la defensa mínima en cada calle (exacto, 0–1). */
export const callDownLeft = (fracs: readonly number[]) => fracs.reduce((a, f) => a / (1 + f), 1)

/** Los tamaños de la tablita, del tercio al pozo y medio. */
export const CALL_DOWN_SIZES = GTO_SIZES.filter((s) => s.frac <= 1.5 && s.frac !== 3 / 4)

export const CALL_DOWN_QUESTIONS: CallDownQuestion[] = ["left", "strong"]

export function makeCallDown(_v: Variant, rng: Rng = Math.random, question?: CallDownQuestion): CallDownDrill {
  const q = question ?? pick(CALL_DOWN_QUESTIONS, rng)
  let d: CallDownDrill | null = null
  for (let tries = 0; tries < 200; tries++) {
    const sizes = [pick(CALL_DOWN_SIZES, rng), pick(CALL_DOWN_SIZES, rng), pick(CALL_DOWN_SIZES, rng)]
    const defends = sizes.map((s) => defendPer100(s.frac))
    const chain = callDownChain(sizes.map((s) => s.frac))
    const left = chain[2]
    if (left < 8) continue
    const base = { kind: "callDown" as const, question: q, sizes, defends, chain, left }
    if (q === "left") {
      // Confusiones: quedarse con la última calle, o restar en vez de ir calle por calle.
      const last = defends[2]
      const subtract = 100 - defends.reduce((a, m) => a + (100 - m), 0)
      if (Math.abs(left - last) < 4) continue
      d = { ...base, options: percentOptions(left, [last, subtract], rng), answer: left }
      break
    }
    // "strong": las que nunca foldean siguen siendo las mismas.
    const strong = pick([3, 4, 5, 6, 8, 10, 12], rng)
    if (strong * 2 > left) continue
    // Confusión: achicarlas como al resto.
    const shrunk = Math.round((strong * left) / 100)
    d = { ...base, strong, options: countOptions(strong, [shrunk], left, rng), answer: strong }
    break
  }
  return d!
}

/** 4 cantidades distintas entre 0 y `max`, con la respuesta y las confusiones típicas. */
function countOptions(answer: number, related: number[], max: number, rng: Rng): number[] {
  const opts = [answer]
  const ok = (x: number) => x >= 0 && x <= max && !opts.includes(x)
  for (const r of related) if (opts.length < 4 && ok(r)) opts.push(r)
  const spread = [-3, -2, -1, 1, 2, 3, 4, 6]
  for (let tries = 0; opts.length < 4 && tries < 100; tries++) {
    const x = answer + pick(spread, rng)
    if (ok(x)) opts.push(x)
  }
  return opts.sort((a, b) => a - b)
}
