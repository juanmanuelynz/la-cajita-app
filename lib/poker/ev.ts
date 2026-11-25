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
  /** Partes (0–1) de cómo responde el rival a tu apuesta: suman 1. */
  fold: number
  call: number
  raise: number
  /** Cuánto ganás si pasás (vas al showdown) y si te pagan la apuesta. */
  eqCheck: number
  eqCall: number
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
const BET_OR_CHECK_KEEP_CHECK = 0.25
const BET_OR_CHECK_KEEP_OBVIOUS = 0.2

export function makeBetOrCheck(_v: Variant, rng: Rng = Math.random): BetOrCheckDrill {
  // Hasta el pozo: es una decisión de valor fino, no de overbet.
  const sizes = GTO_SIZES.filter((s) => s.frac <= 1)
  let d: BetOrCheckDrill | null = null
  for (let tries = 0; tries < 200; tries++) {
    const size = pick(sizes, rng)
    const pot = (1 + Math.floor(rng() * 5)) * 1200
    const bet = pot * size.frac
    const raise = stepInt(0, 25, 5, rng)
    const fold = stepInt(10, 85 - raise, 5, rng)
    const call = 100 - fold - raise
    const eqCheck = stepInt(40, 85, 5, rng)
    // Cuando te pagan estás peor que en el showdown sin apostar: pagan las mejores.
    const eqCall = Math.max(5, eqCheck - stepInt(10, 35, 5, rng))
    const base = { pot, bet, fold: fold / 100, call: call / 100, raise: raise / 100, eqCall: eqCall / 100 }
    const ec = evCheck(pot, eqCheck / 100)
    const eb = evBet(base)
    d = {
      kind: "betOrCheck",
      ...base,
      sizeName: size.name,
      eqCheck: eqCheck / 100,
      evCheck: ec,
      evBet: eb,
      shouldBet: eb > ec,
    }
    // Y al menos $200: los botones muestran el promedio redondeado a $100.
    if (Math.abs(eb - ec) < Math.max(BET_OR_CHECK_GAP * pot, 200)) continue
    // Al azar, pasar gana 8 de cada 10: se descartan la mayoría para que
    // apostar y pasar salgan parecido (si no, se aprende a tocar siempre pasar).
    if (!d.shouldBet && rng() > BET_OR_CHECK_KEEP_CHECK) continue
    // Y "apuesto si foldea mucho" no tiene que alcanzar: hay que hacer la cuenta.
    if (d.shouldBet === d.fold > 0.5 && rng() > BET_OR_CHECK_KEEP_OBVIOUS) continue
    break
  }
  return d!
}

// ── 2. Defensa contra bluffs con chances ───────────────────────────────────

export type SemiBluffKind = "showdown" | "draw"

export interface SemiBluffDrill {
  kind: "semiBluff"
  /** showdown: river, su bluff ganaría a veces si pasara. draw: turn, su bluff es un proyecto. */
  type: SemiBluffKind
  street: "turn" | "river"
  pot: number
  /** All-in del rival: no se puede subir. */
  bet: number
  sizeName: string
  /** Parte del pozo que su bluff se llevaría pasando (s) y su chance de ganar si lo pagás (q). */
  checkShare: number
  drawEquity: number
  /** Defensa mínima de siempre (para comparar). */
  plainMdf: number
  /** Parte de tus manos con la que hay que seguir (0–1) y las opciones en % enteros. */
  defend: number
  options: number[]
  answer: number
}

export function semiBluffDefense(pot: number, bet: number, checkShare: number, drawEquity: number) {
  return ((1 - checkShare) * pot) / (pot + bet - drawEquity * (pot + 2 * bet))
}

export function makeSemiBluff(_v: Variant, rng: Rng = Math.random, type?: SemiBluffKind): SemiBluffDrill {
  const t: SemiBluffKind = type ?? (rng() < 0.5 ? "showdown" : "draw")
  let d: SemiBluffDrill | null = null
  for (let tries = 0; tries < 200; tries++) {
    const size = pick(GTO_SIZES, rng)
    const pot = (1 + Math.floor(rng() * 5)) * 1200
    const bet = pot * size.frac
    const s = stepInt(10, 30, 5, rng) / 100
    // Con un proyecto, pasar le deja más o menos su chance de ganar ese pozo.
    const checkShare = s
    const drawEquity = t === "draw" ? s : 0
    const defend = semiBluffDefense(pot, bet, checkShare, drawEquity)
    const plain = mdf(pot, bet)
    const answer = Math.round(defend * 100)
    const plainPct = Math.round(plain * 100)
    // Confusiones típicas: la defensa de siempre y restarle la chance del bluff.
    const related = [plainPct, Math.round((plain - s) * 100)]
    d = {
      kind: "semiBluff",
      type: t,
      street: t === "draw" ? "turn" : "river",
      pot,
      bet,
      sizeName: size.name,
      checkShare,
      drawEquity,
      plainMdf: plain,
      defend,
      options: percentOptions(answer, related, rng),
      answer,
    }
    // Que se note la diferencia con la defensa de siempre (si no, la pregunta no enseña nada).
    if (Math.abs(answer - plainPct) >= 4 && answer > 0 && answer < 100) break
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
// river es el producto de las tres. Las manos que nunca foldea (por ejemplo
// los colores ya hechos) pasan a ser una parte mucho mayor de lo que queda.

export type CallDownQuestion = "left" | "strong"

export interface CallDownDrill {
  kind: "callDown"
  question: CallDownQuestion
  /** Tamaño de cada apuesta como fracción del pozo, y cómo se dice. */
  sizes: { frac: number; name: string }[]
  /** Parte de su rango que sigue en cada calle (0–1). */
  defends: number[]
  /** Parte de su rango del flop que llega al river pagando todo (0–1). */
  left: number
  /** Solo en "strong": parte de su rango del flop que son manos que nunca foldea (0–1). */
  strong?: number
  options: number[]
  answer: number
}

/** Lo que queda de su rango si paga justo la defensa mínima en cada calle. */
export const callDownLeft = (fracs: readonly number[]) => fracs.reduce((a, f) => a / (1 + f), 1)

export const CALL_DOWN_QUESTIONS: CallDownQuestion[] = ["left", "strong"]

export function makeCallDown(_v: Variant, rng: Rng = Math.random, question?: CallDownQuestion): CallDownDrill {
  const q = question ?? pick(CALL_DOWN_QUESTIONS, rng)
  // Del tercio al pozo y medio: las tres apuestas de una mano normal.
  const sizesPool = GTO_SIZES.filter((s) => s.frac <= 1.5)
  let d: CallDownDrill | null = null
  for (let tries = 0; tries < 200; tries++) {
    const sizes = [pick(sizesPool, rng), pick(sizesPool, rng), pick(sizesPool, rng)]
    const defends = sizes.map((s) => 1 / (1 + s.frac))
    const left = callDownLeft(sizes.map((s) => s.frac))
    const leftPct = Math.round(left * 100)
    const lastPct = Math.round(defends[2] * 100)
    if (q === "left") {
      // Confusiones: quedarse con la última calle, o restar en vez de multiplicar.
      const subtract = Math.round((1 - defends.reduce((a, m) => a + (1 - m), 0)) * 100)
      d = { kind: "callDown", question: q, sizes, defends, left, options: percentOptions(leftPct, [lastPct, subtract], rng), answer: leftPct }
      if (Math.abs(leftPct - lastPct) >= 4) break
      continue
    }
    // "strong": entre 3% y 15% de su rango del flop que nunca foldea, y que no pase del 90% de lo que queda.
    const strongPct = pick([3, 4, 5, 6, 8, 10, 12, 15], rng)
    const answer = Math.round((strongPct / 100 / left) * 100)
    if (answer > 90 || answer < 10) continue
    // Confusiones: el porcentaje del flop tal cual, o dividir solo por la última calle.
    const related = [strongPct, Math.round((strongPct / 100 / defends[2]) * 100)]
    d = {
      kind: "callDown",
      question: q,
      sizes,
      defends,
      left,
      strong: strongPct / 100,
      options: percentOptions(answer, related, rng),
      answer,
    }
    break
  }
  return d!
}
