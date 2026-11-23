// Cuentas de equilibrio (GTO) en el river. Son fórmulas exactas del juego
// simplificado "river, apuesta única": quien apuesta tiene manos que ganan
// siempre (valor) o que pierden siempre (bluff), y quien paga no puede subir.
// No dependen del juego ni del mazo: valen igual en Hold'em, Omaha y Manhattan.
//
//   P = pozo antes de la apuesta, B = apuesta
//   - Fold que necesita un bluff para no perder:   B / (P + B)        ("alfa")
//   - Defensa mínima (MDF):                        P / (P + B) = 1 - alfa
//   - Parte de las apuestas que pueden ser bluff:  B / (P + 2B)       (= las pot odds del que paga)
//   - Bluffs por cada mano de valor:              B / (P + B)

import type { Rng } from "./cards"
import type { Variant } from "./variants"

export type GtoQuestion = "defend" | "foldNeeded" | "bluffShare" | "bluffCombos"

export const GTO_QUESTIONS: GtoQuestion[] = ["defend", "foldNeeded", "bluffShare", "bluffCombos"]

/** Tamaños de apuesta (fracción del pozo) y cómo se dicen en la mesa. */
export const GTO_SIZES: { frac: number; name: string }[] = [
  { frac: 1 / 3, name: "un tercio del pozo" },
  { frac: 1 / 2, name: "medio pozo" },
  { frac: 2 / 3, name: "dos tercios del pozo" },
  { frac: 3 / 4, name: "tres cuartos del pozo" },
  { frac: 1, name: "el pozo" },
  { frac: 3 / 2, name: "pozo y medio" },
  { frac: 2, name: "el doble del pozo" },
]

export const alpha = (pot: number, bet: number) => bet / (pot + bet)
export const mdf = (pot: number, bet: number) => pot / (pot + bet)
export const bluffShare = (pot: number, bet: number) => bet / (pot + 2 * bet)

export interface GtoDrill {
  kind: "gto"
  question: GtoQuestion
  pot: number
  bet: number
  sizeName: string
  /** Solo en "bluffCombos": cuántas manos de valor tenés. */
  value?: number
  /** Opciones ordenadas: porcentajes enteros (0–100) o cantidad de bluffs. */
  options: number[]
  answer: number
}

const SPREAD = [-20, -15, -10, 10, 15, 20]

function percentOptions(answer: number, related: number[], rng: Rng): number[] {
  const opts = [answer]
  const far = (x: number) => x > 0 && x < 100 && opts.every((o) => Math.abs(o - x) >= 6)
  // Primero las confusiones típicas (usar otra de las fórmulas), después corridas.
  for (const r of related) if (opts.length < 4 && far(r)) opts.push(r)
  for (let tries = 0; opts.length < 4 && tries < 50; tries++) {
    const x = answer + SPREAD[Math.floor(rng() * SPREAD.length)]
    if (far(x)) opts.push(x)
  }
  return opts.sort((a, b) => a - b)
}

export function makeGto(_v: Variant, rng: Rng = Math.random, question?: GtoQuestion): GtoDrill {
  const q = question ?? GTO_QUESTIONS[Math.floor(rng() * GTO_QUESTIONS.length)]
  const size = GTO_SIZES[Math.floor(rng() * GTO_SIZES.length)]
  // Pozos múltiplos de $600: todos los tamaños dan montos redondos.
  const pot = (1 + Math.floor(rng() * 10)) * 600
  const bet = pot * size.frac
  const r = (x: number) => Math.round(x * 100)
  const all = [r(mdf(pot, bet)), r(alpha(pot, bet)), r(bluffShare(pot, bet)), r(1 - bluffShare(pot, bet))]
  const base = { kind: "gto" as const, question: q, pot, bet, sizeName: size.name }

  if (q === "bluffCombos") {
    // Valor con el que la cuenta da justa (sin redondeos raros).
    const a = alpha(pot, bet)
    const exact = Array.from({ length: 18 }, (_, i) => i + 4).filter((n) => Math.abs(n * a - Math.round(n * a)) < 1e-9)
    const value = exact[Math.floor(rng() * exact.length)]
    const answer = Math.round(value * a)
    const opts = [answer]
    const cands = [Math.round(value * mdf(pot, bet)), Math.round(value * bluffShare(pot, bet)), value, answer + 2, answer - 2, answer + 4]
    for (const c of cands) if (opts.length < 4 && c >= 0 && !opts.includes(c)) opts.push(c)
    for (let k = 1; opts.length < 4; k++) if (!opts.includes(answer + k)) opts.push(answer + k)
    return { ...base, value, options: opts.sort((a, b) => a - b), answer }
  }

  const answer = q === "defend" ? all[0] : q === "foldNeeded" ? all[1] : all[2]
  return { ...base, options: percentOptions(answer, all.filter((x) => x !== answer), rng), answer }
}
