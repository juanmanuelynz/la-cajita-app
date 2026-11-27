// Las 8 lecciones de Aprender (Truco). Texto del artefacto "Truco argentino"
// tal cual, salvo lo que cambió con las reglas del motor (27/11/2026, ver
// docs/plan-truco.md): tras una parda tira el mano, un envido se puede subir
// aunque ya hayas tirado tu carta, y los puntos se anotan con fósforos.

import type { ReactNode } from "react"
import { LADDER, SUITS, type Suit, type TrucoCard } from "@/lib/truco/engine"
import { SpanishCard, SuitPip } from "./spanish-card"
import { Fosforos } from "./fosforos"

const c = (num: number, suit: Suit): TrucoCard => ({ num, suit })

function Tip({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border-l-4 border-primary bg-primary/10 px-3 py-2 text-sm">{children}</p>
}

function Example({ cards, children }: { cards: TrucoCard[]; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
      <div className="flex shrink-0 gap-1">
        {cards.map((x) => (
          <SpanishCard key={`${x.num}-${x.suit}`} card={x} size="sm" />
        ))}
      </div>
      <p className="text-sm">{children}</p>
    </div>
  )
}

function PointsTable({ rows }: { rows: [string, string, string][] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
          <th className="py-1.5 pr-2 font-medium">Se cantó</th>
          <th className="py-1.5 pr-2 font-medium">Quiero</th>
          <th className="py-1.5 font-medium">No quiero</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r[0]} className="border-t align-top">
            <td className="py-1.5 pr-2">{r[0]}</td>
            <td className="py-1.5 pr-2 font-semibold">{r[1]}</td>
            <td className="py-1.5">{r[2]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Ladder() {
  return (
    <ol className="divide-y">
      {LADDER.map((step, i) => (
        <li key={step.name} className="grid grid-cols-[1.5rem_1fr] items-center gap-x-3 gap-y-1 py-2">
          <span className="text-right font-bold text-primary">{i + 1}</span>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <div className="flex gap-1">
              {step.cards.map((x) => (
                <SpanishCard key={`${x.num}-${x.suit}`} card={x} size="xs" />
              ))}
            </div>
            <div className="text-sm leading-tight">
              <b>{step.name}</b>
              {step.note && <div className="text-xs text-muted-foreground">{step.note}</div>}
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

const H = ({ children }: { children: ReactNode }) => <h4 className="pt-2 font-semibold">{children}</h4>
const List = ({ children }: { children: ReactNode }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>

export interface Lesson {
  title: string
  /** Una línea para el menú. */
  summary: string
  body: () => ReactNode
}

export const LESSONS: Lesson[] = [
  {
    title: "La baraja",
    summary: "40 cartas, cuatro palos",
    body: () => (
      <>
        <p>
          El truco se juega con la <b>baraja española de 40 cartas</b>: cuatro palos y, en cada uno, del 1 al 7 y las
          tres figuras (10 sota, 11 caballo, 12 rey). No hay ni 8 ni 9.
        </p>
        <div className="flex flex-wrap justify-around gap-4 py-2">
          {SUITS.map((s) => (
            <div key={s} className="flex flex-col items-center gap-1 text-sm font-semibold capitalize">
              <SuitPip suit={s} className="size-10" />
              {s}
            </div>
          ))}
        </div>
        <p>
          Se puede jugar de a dos (mano a mano), de a cuatro o de a seis, en parejas. Acá aprendés el{" "}
          <b>mano a mano</b>, que es la base de todos.
        </p>
      </>
    ),
  },
  {
    title: "Cómo es una mano",
    summary: "Tres bazas, el mano y el pie, las pardas",
    body: () => (
      <>
        <p>
          Cada uno recibe <b>3 cartas</b>. Se juegan hasta <b>tres bazas</b> (también les dicen manos o vueltas: primera,
          segunda y tercera): en cada una, cada jugador tira una carta y gana la más alta.
        </p>
        <p>
          <b>Gana la mano quien gana dos bazas.</b> Si alguien gana las dos primeras, la tercera no se juega.
        </p>
        <p>
          El que reparte es el <b>pie</b>; el otro es <b>mano</b>: juega primero y gana los empates de envido. Se alternan
          en cada mano.
        </p>
        <p>Quien gana una baza tira primero en la siguiente. Si la baza fue parda, tira primero el mano.</p>
        <H>Las pardas (empates)</H>
        <List>
          <li>Si la primera es parda, gana quien gane la segunda.</li>
          <li>Si alguien ganó la primera y después hay parda, gana quien ganó la primera.</li>
          <li>Si las tres son pardas, gana el mano.</li>
        </List>
        <p>
          Una mano sin cantos vale <b>1 punto</b>.
        </p>
      </>
    ),
  },
  {
    title: "Qué carta gana",
    summary: "La jerarquía, de la más fuerte a la más débil",
    body: () => (
      <>
        <p>
          El orden no es el de los números. Esta es la jerarquía, de la más fuerte a la más débil. Las cartas de una misma
          fila empatan (hacen <b>parda</b>).
        </p>
        <Ladder />
        <Tip>
          Un truco para memorizarla: primero las cuatro &quot;bravas&quot; (ancho de espada, ancho de basto, 7 de espada,
          7 de oro), después 3, 2, anchos falsos, figuras de mayor a menor, los sietes falsos y del 6 al 4.
        </Tip>
      </>
    ),
  },
  {
    title: "El envido",
    summary: "Los tantos y cuánto vale",
    body: () => (
      <>
        <p>
          El envido es una apuesta aparte, sobre <b>los tantos</b> de tus cartas. Se canta solo en la primera baza, antes
          de que tires tu primera carta.
        </p>
        <H>Cómo se cuentan los tantos</H>
        <List>
          <li>
            Del 1 al 7 valen su número; <b>las figuras valen 0</b>.
          </li>
          <li>
            Si tenés <b>dos cartas del mismo palo</b>: se suman y se agregan 20.
          </li>
          <li>Si no tenés palo repetido, vale tu carta más alta.</li>
        </List>
        <Example cards={[c(7, "oro"), c(6, "oro"), c(1, "espada")]}>
          Dos de oro: 20 + 7 + 6 = <b>33</b>, lo máximo posible.
        </Example>
        <Example cards={[c(12, "copa"), c(5, "copa"), c(3, "basto")]}>
          Dos de copa: 20 + 0 + 5 = <b>25</b>.
        </Example>
        <Example cards={[c(11, "oro"), c(4, "basto"), c(6, "espada")]}>
          Ningún palo repetido: vale el 6, <b>6</b>.
        </Example>
        <p>Con tres del mismo palo se suman las dos más altas (sin flor).</p>
        <H>Cuánto vale</H>
        <PointsTable
          rows={[
            ["Envido", "2", "1"],
            ["Real envido", "3", "1"],
            ["Envido + envido", "4", "2"],
            ["Envido + real envido", "5", "2"],
            ["Envido + envido + real envido", "7", "4"],
            ["Falta envido", "lo que le falta al que va ganando", "1 (o lo cantado antes)"],
          ]}
        />
        <p>
          Cuando alguien canta, el otro puede querer, no querer o subir (aunque ya haya tirado su carta). Si no quiere, el
          que cantó se lleva lo que valía lo anterior (o 1 si era el primer canto). Si quieren, el mano dice sus tantos
          primero (&quot;tengo 27&quot;); el otro dice los suyos si son más (&quot;28 son mejores&quot;) o &quot;son
          buenas&quot;. En empate gana el mano.
        </p>
        <Tip>
          La falta envido se juega distinto según el lugar: en algunos, si los dos están en las malas, se juega el partido
          entero. Acá vale lo que le falta para ganar al que va adelante.
        </Tip>
      </>
    ),
  },
  {
    title: "El truco",
    summary: "Truco, retruco, vale cuatro y el mazo",
    body: () => (
      <>
        <p>
          Cuando es tu turno podés cantar <b>truco</b>: apostás a que ganás la mano.
        </p>
        <PointsTable
          rows={[
            ["Truco", "2", "1"],
            ["Retruco", "3", "2"],
            ["Vale cuatro", "4", "3"],
          ]}
        />
        <List>
          <li>
            El que recibe el truco puede querer, no querer, o subir en el acto: &quot;<b>quiero retruco</b>&quot;.
          </li>
          <li>
            Una vez querido, <b>solo puede subir quien quiso</b>, cuando le toque jugar.
          </li>
          <li>
            Si no quieren, el que cantó se lleva lo que valía antes (1 por el truco, 2 por el retruco, 3 por el vale
            cuatro).
          </li>
        </List>
        <H>El envido va primero</H>
        <p>
          Si te cantan truco en la primera baza y todavía no tiraste carta, podés contestar con envido. Se resuelve el
          envido y después contestás el truco.
        </p>
        <H>Irse al mazo</H>
        <p>
          Si tus cartas son malas, podés <b>irte al mazo</b>: abandonás la mano y el otro se lleva lo que valía (1 si no
          había truco querido). Muchas veces conviene más que perder un truco o un retruco.
        </p>
        <Tip>
          El truco es un juego de mentir: cantar con malas cartas para que el otro no quiera es parte del juego. La máquina
          también lo hace.
        </Tip>
      </>
    ),
  },
  {
    title: "La partida",
    summary: "A 15 o a 30, malas y buenas, cómo se anota",
    body: () => (
      <>
        <p>
          Se juega a <b>15 o a 30 puntos</b>. A 30 se divide en dos mitades: los primeros 15 son <b>las malas</b> y los
          otros 15, <b>las buenas</b>.
        </p>
        <p>
          Los puntos se anotan con <b>fósforos</b> (o palitos, o porotos), de a cinco, formando un cuadrado con una
          diagonal:
        </p>
        <div className="flex flex-wrap items-end gap-4 py-1">
          {[1, 2, 3, 4, 5, 8].map((n) => (
            <figure key={n} className="flex flex-col items-start gap-1">
              <Fosforos n={n} className="flex-nowrap" />
              <figcaption className="text-xs text-muted-foreground">{n}</figcaption>
            </figure>
          ))}
        </div>
        <p>
          Los puntos del envido se anotan en cuanto se resuelve: si con eso llegás al final, ganás aunque la mano no haya
          terminado.
        </p>
      </>
    ),
  },
  {
    title: "La flor (opcional)",
    summary: "Tres del mismo palo",
    body: () => (
      <>
        <p>
          Algunos juegan <b>con flor</b>: se acuerda antes de empezar. La partida de esta app es sin flor, pero conviene
          conocerla.
        </p>
        <Example cards={[c(7, "basto"), c(5, "basto"), c(11, "basto")]}>
          Tres del mismo palo son <b>flor</b>: 20 + 7 + 5 + 0 = 32 de flor.
        </Example>
        <List>
          <li>Quien tiene flor debe cantarla, y anula el envido. Vale 3 puntos.</li>
          <li>
            Si los dos tienen flor, se puede cantar <b>contraflor</b> o <b>contraflor al resto</b>.
          </li>
        </List>
        <p>Las reglas de la flor cambian mucho de un lugar a otro: acordalas antes de jugar.</p>
      </>
    ),
  },
  {
    title: "Las señas",
    summary: "Para el truco en parejas",
    body: () => (
      <>
        <p>
          En el truco en parejas (de a cuatro o seis), los compañeros se pasan señas para avisarse qué cartas tienen, sin
          que el rival las vea. Algunas de las más conocidas:
        </p>
        <List>
          <li>Ancho de espada: levantar las cejas.</li>
          <li>Ancho de basto: guiñar un ojo.</li>
          <li>Siete de espada: correr la boca hacia la derecha.</li>
          <li>Siete de oro: correr la boca hacia la izquierda.</li>
          <li>Un 3: morderse el labio.</li>
          <li>Un 2: tirar un beso (se usa poco).</li>
        </List>
        <p>Varían según la mesa: cada pareja acuerda las suyas. Mano a mano no hay señas: solo cara de póker.</p>
      </>
    ),
  },
]
