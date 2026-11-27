// Ejercicios de Practicar (Truco): ¿Qué carta gana?, ¿Cuántos tantos tenés? y
// ¿Cuántos puntos son? Port de los del artefacto "Truco argentino". Puros y
// sembrables (como lib/poker/drills.ts): la pantalla los dibuja.

import { shuffle, type Rng } from "../poker/cards"
import {
  cardName,
  compare,
  deck,
  ENVIDO_LABEL,
  envidoExplain,
  envidoNoQuerido,
  envidoPoints,
  envidoQuerido,
  envidoValue,
  rank,
  sameCard,
  TRUCO_LABEL,
  trucoValue,
  type EnvidoCall,
  type TrucoCard,
  type TrucoLevel,
} from "./engine"
import type { TrucoQuizId } from "./quiz-ids"

export interface QuizOption {
  /** Texto de la opción (un número o "Parda"), o una carta. */
  label?: string
  card?: TrucoCard
  ok: boolean
}

export interface Quiz {
  id: TrucoQuizId
  /** La pregunta. Puede traer partes en **negrita**. */
  prompt: string
  /** Cartas para mostrar arriba de las opciones (las de tu mano en el envido). */
  cards?: TrucoCard[]
  options: QuizOption[]
  /** Por qué, para mostrar al responder. */
  explain: string
}

export const QUIZ_TITLES: Record<TrucoQuizId, string> = {
  gana: "¿Qué carta gana?",
  envido: "¿Cuántos tantos tenés?",
  puntos: "¿Cuántos puntos son?",
}

const pick = <T,>(xs: readonly T[], rng: Rng): T => xs[Math.floor(rng() * xs.length)]
const uniq = <T,>(xs: T[]) => [...new Set(xs)]

/** Opciones numéricas: la correcta más hasta 3 distintas, mezcladas. */
function numberOptions(ok: number, wrong: number[], rng: Rng, min: number, max: number): QuizOption[] {
  const valid = (x: number) => x !== ok && x >= min && x <= max
  let w = shuffle(uniq(wrong.filter(valid)), rng).slice(0, 3)
  // Si no alcanzan, se completa con los vecinos de la correcta.
  for (let d = 1; w.length < 3 && d < 40; d++) {
    for (const x of [ok + d, ok - d]) if (w.length < 3 && valid(x) && !w.includes(x)) w.push(x)
  }
  w = w.slice(0, 3)
  return shuffle([ok, ...w], rng).map((n) => ({ label: String(n), ok: n === ok }))
}

export function makeGana(rng: Rng = Math.random): Quiz {
  const d = shuffle(deck(), rng)
  const a = d[0]
  let b = d[1]
  if (rng() < 0.15) {
    // A veces, una parda.
    const same = deck().filter((x) => rank(x) === rank(a) && !sameCard(x, a))
    if (same.length) b = pick(same, rng)
  }
  const w = compare(a, b)
  return {
    id: "gana",
    prompt: "¿Cuál gana la baza?",
    options: [
      { card: a, ok: w === 0 },
      { card: b, ok: w === 1 },
      { label: "Parda", ok: w === -1 },
    ],
    explain:
      w === -1
        ? `Parda: ${cardName(a)} y ${cardName(b)} están en el mismo escalón.`
        : `Gana ${cardName(w === 0 ? a : b)}: está más alta en la jerarquía que ${cardName(w === 0 ? b : a)}.`,
  }
}

export function makeEnvido(rng: Rng = Math.random): Quiz {
  let hand = shuffle(deck(), rng).slice(0, 3)
  // Más seguido con palo repetido, que es lo interesante.
  if (rng() < 0.6) {
    const s = hand[0].suit
    const same = deck().filter((x) => x.suit === s && !sameCard(x, hand[0]) && !sameCard(x, hand[2]))
    hand[1] = pick(same, rng)
  }
  hand = shuffle(hand, rng)
  const ok = envidoPoints(hand)
  const sum = hand.reduce((t, c) => t + envidoValue(c), 0)
  // Errores típicos: olvidarse (o sumar de más) los 20, sumar las tres, contar figuras como 10.
  const withFigures = 20 + hand.reduce((t, c) => t + Math.min(c.num, 10), 0) - Math.min(...hand.map((c) => Math.min(c.num, 10)))
  const wrong = [ok >= 20 ? ok - 20 : ok + 20, sum, sum + 20, withFigures, ok + 1, ok - 1, ok + 2]
  return {
    id: "envido",
    prompt: "¿Cuánto tenés de envido?",
    cards: hand,
    options: numberOptions(ok, wrong, rng, 0, 33),
    explain: `${envidoExplain(hand)}.`,
  }
}

const ENVIDO_SEQS: EnvidoCall[][] = [
  ["envido"],
  ["real"],
  ["envido", "envido"],
  ["envido", "real"],
  ["envido", "envido", "real"],
  ["falta"],
  ["envido", "falta"],
  ["real", "falta"],
]

export function makePuntos(rng: Rng = Math.random): Quiz {
  if (rng() < 0.55) {
    const calls = pick(ENVIDO_SEQS, rng)
    const quiso = rng() < 0.5
    const score: [number, number] = [Math.floor(rng() * 25), Math.floor(rng() * 25)]
    const falta = calls.includes("falta")
    const ok = quiso ? envidoQuerido(calls, score, 30) : envidoNoQuerido(calls)
    const said = calls.map((k) => ENVIDO_LABEL[k].toLowerCase()).join(", ")
    const otherWay = quiso ? envidoNoQuerido(calls) : envidoQuerido(calls, score, 30)
    return {
      id: "puntos",
      prompt:
        `Se cantó **${said}** y **${quiso ? "quisieron" : "no quisieron"}**.` +
        (falta ? ` El partido es a 30 y va ${score[0]} a ${score[1]}.` : "") +
        " ¿Cuántos puntos se lleva el que gana?",
      options: numberOptions(ok, [ok + 1, ok - 1, ok + 2, otherWay], rng, 1, 30),
      explain: quiso
        ? falta
          ? `Falta envido querido: lo que le falta al que va ganando, 30 − ${Math.max(...score)} = ${ok}.`
          : `Querido: se suma todo lo cantado = ${ok}.`
        : calls.length === 1
          ? "No querido en el primer canto: 1 punto."
          : `No querido: se cobra lo que valía antes del último canto = ${ok}.`,
    }
  }
  const level = (1 + Math.floor(rng() * 3)) as Exclude<TrucoLevel, 0>
  const quiso = rng() < 0.5
  const ok = quiso ? trucoValue(level) : level
  const said = TRUCO_LABEL.slice(1, level + 1)
    .map((x) => x.toLowerCase())
    .join(", ")
  return {
    id: "puntos",
    prompt:
      `En la mano se cantó **${said}** y el último canto ` +
      (quiso ? "**fue querido**. ¿Cuántos puntos gana quien gane la mano?" : "**no fue querido**. ¿Cuántos puntos se lleva quien cantó?"),
    options: shuffle([1, 2, 3, 4], rng).map((n) => ({ label: String(n), ok: n === ok })),
    explain: quiso ? `${TRUCO_LABEL[level]} querido vale ${ok}.` : `${TRUCO_LABEL[level]} no querido: vale lo anterior, ${ok}.`,
  }
}

export const MAKERS: Record<TrucoQuizId, (rng?: Rng) => Quiz> = {
  gana: makeGana,
  envido: makeEnvido,
  puntos: makePuntos,
}
