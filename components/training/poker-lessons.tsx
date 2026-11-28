// Lecciones de Aprender (Poker): las reglas del póker con ciegas (Hold'em,
// Omaha y Manhattan), pedidas el 28/11/2026. Las reglas generales son las de
// cualquier mesa de casino (orden de habla, mínimos, all-in, quién muestra
// primero: las mismas que usa la Mesa de práctica, lib/poker/table.ts); lo
// propio de La Cajita (Manhattan, short deck) sale del evaluador. La última,
// "Cómo jugamos nosotros: con luz", son las reglas de la casa que confirmó el
// grupo el 28/11/2026 (las mismas que la Mesa de práctica con luz).

import type { ReactNode } from "react"
import type { Lesson } from "@/components/lessons-menu"
import { parseCards } from "@/lib/poker/cards"
import type { DrillId } from "@/lib/poker/drill-ids"
import { GAMES, type Variant } from "@/lib/poker/variants"
import { HandRankings } from "./hand-rankings"
import { OmahaPrinciples } from "./omaha-principles"
import { CardRow } from "./playing-card"
import { PreflopRanges } from "./preflop"

function Tip({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border-l-4 border-primary bg-primary/10 px-3 py-2 text-sm">{children}</p>
}

function Example({ hole, board, children }: { hole: string; board?: string; children: ReactNode }) {
  return (
    <div className="space-y-2 rounded-xl bg-muted p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Tu mano</div>
          <CardRow cards={parseCards(hole)} size="sm" className="flex-nowrap" />
        </div>
        {board && (
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Mesa</div>
            <CardRow cards={parseCards(board)} size="sm" className="flex-nowrap" />
          </div>
        )}
      </div>
      <p className="text-sm">{children}</p>
    </div>
  )
}

const H = ({ children }: { children: ReactNode }) => <h4 className="pt-2 font-semibold">{children}</h4>
const List = ({ children }: { children: ReactNode }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>
const Steps = ({ children }: { children: ReactNode }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>

export interface PokerLesson extends Lesson {
  /** Ejercicio de Entrenar para practicar lo de la lección. */
  practice?: { drill: Exclude<DrillId, "preflopVs">; label: string }
}

/** `picker` es el selector de juego y mazo de Entrenar; `variant`, lo elegido. */
export function pokerLessons({ picker, variant }: { picker: ReactNode; variant: Variant }): PokerLesson[] {
  return [
    {
      title: "Las jugadas",
      summary: "De la escalera real a la carta alta",
      practice: { drill: "whoWins", label: "Practicar: ¿Quién gana?" },
      body: () => (
        <>
          <p>
            Gana la mejor combinación de <b>5 cartas</b>. Estas son, de la más fuerte a la más floja. Si dos tienen la
            misma jugada, gana la de cartas más altas (un par de K le gana a un par de 9) y, si siguen iguales, las
            cartas que acompañan.
          </p>
          {picker}
          <HandRankings variant={variant} />
        </>
      ),
    },
    {
      title: "Long y Short",
      summary: "Mazo de 52 o de 36 cartas",
      practice: { drill: "compare", label: "Practicar: ¿Cuál es mejor?" },
      body: () => (
        <>
          <p>
            Cualquiera de los tres juegos se puede jugar con dos mazos:
          </p>
          <List>
            <li>
              <b>Long:</b> el mazo entero, 52 cartas.
            </li>
            <li>
              <b>Short:</b> 36 cartas, sin los 2, 3, 4 ni 5.
            </li>
          </List>
          <H>Lo que cambia en Short</H>
          <List>
            <li>
              El <b>color le gana al full</b>: con solo 9 cartas por palo, el color sale menos.
            </li>
            <li>
              La escalera más baja es <b>A-6-7-8-9</b> (el As hace de 5).
            </li>
            <li>
              En La Cajita la <b>escalera le gana a la pierna</b>, como en Long.
            </li>
          </List>
          <Example hole="As 8h" board="9h 6s 7h Kc Jc">
            Con el As y el 8 armás <b>A-6-7-8-9</b>: escalera al 9, la más baja de Short.
          </Example>
        </>
      ),
    },
    {
      title: "Hold'em, Omaha y Manhattan",
      summary: "Cuántas cartas te tocan y cuántas usás",
      practice: { drill: "usable", label: "Practicar: ¿Qué tenés?" },
      body: () => (
        <>
          <p>
            Los tres se juegan igual: cartas propias boca abajo, cinco cartas comunitarias en la mesa y cuatro rondas de
            apuestas. Lo que cambia es cuántas cartas te tocan y <b>cuántas de ellas podés usar</b>.
          </p>
          <H>{GAMES.holdem.name}</H>
          <p>{GAMES.holdem.rule}</p>
          <Example hole="Ah Kh" board="Qh 7h 2h 9c 4s">
            Color al As con tus dos cartas y tres de la mesa. También podrías usar una sola tuya, o ninguna.
          </Example>
          <H>{GAMES.omaha.name}</H>
          <p>{GAMES.omaha.rule}</p>
          <Example hole="Ah Ks Qd Jc" board="Th 7h 2h 9h 4s">
            En la mesa hay cuatro corazones, pero vos tenés uno solo: <b>no hay color</b>. Tenés que usar dos tuyas, y
            con A-K… no ligás nada: As alto.
          </Example>
          <H>{GAMES.manhattan.name}</H>
          <p>{GAMES.manhattan.rule}</p>
          <Example hole="9s 9d 9c Kh 2d" board="Ks 7h 3c Jd 4s">
            Usando tres tuyas (los tres 9) con dos de la mesa (K y J), tenés <b>pierna de 9</b>. Si solo pudieras usar
            dos tuyas, como en Omaha, lo mejor sería un par de K.
          </Example>
          <Tip>
            El error más común en Omaha y Manhattan es contar una jugada que usa una sola carta propia, o cuatro de la
            mesa.
          </Tip>
        </>
      ),
    },
    {
      title: "El botón y las ciegas",
      summary: "Quién reparte y quién pone antes de ver las cartas",
      body: () => (
        <>
          <p>
            En cada mano, uno de la mesa es el que <b>reparte</b>: se lo marca con el <b>botón</b> (la ficha con la
            «D»). Después de cada mano el botón pasa al de su izquierda, así todos van rotando.
          </p>
          <H>Las ciegas</H>
          <p>Antes de repartir, los dos de la izquierda del botón ponen plata sin ver sus cartas:</p>
          <List>
            <li>
              <b>Ciega chica:</b> el de la izquierda del botón. Suele ser la mitad de la grande.
            </li>
            <li>
              <b>Ciega grande:</b> el siguiente. Es la apuesta mínima de la mano.
            </li>
          </List>
          <p>
            Así siempre hay algo en el pozo para pelear. Como el botón rota, todos ponen las ciegas la misma cantidad de
            veces.
          </p>
          <H>El reparto</H>
          <p>
            Se reparte de a una carta, empezando por la ciega chica y siguiendo hacia la izquierda, hasta que cada uno
            tiene las suyas (2 en Hold&apos;em, 4 en Omaha, 5 en Manhattan). Antes del flop, del turn y del river se
            «quema» una carta: se descarta boca abajo, para que nadie pueda ver la que viene.
          </p>
          <Tip>
            <b>Mano a mano</b> (quedan dos) cambia: el que tiene el botón pone la ciega chica y el otro la grande.
          </Tip>
        </>
      ),
    },
    {
      title: "Las rondas de apuestas",
      summary: "Antes del flop, flop, turn y river",
      practice: { drill: "preflop", label: "Practicar: Abrir (ciegas)" },
      body: () => (
        <>
          <H>Lo que podés hacer cuando te toca</H>
          <List>
            <li>
              <b>Pasar</b> (check): seguir sin poner nada. Solo si nadie apostó en esa ronda.
            </li>
            <li>
              <b>Apostar</b>: poner plata cuando nadie apostó todavía.
            </li>
            <li>
              <b>Pagar</b> (call): poner lo mismo que la apuesta más alta.
            </li>
            <li>
              <b>Subir</b> (raise): poner más que la apuesta más alta. Los demás tienen que pagar la diferencia, volver a
              subir o irse.
            </li>
            <li>
              <b>Irse</b> (fold): tirar tus cartas. Perdés lo que pusiste en esa mano.
            </li>
          </List>
          <H>Las cuatro rondas</H>
          <Steps>
            <li>
              <b>Antes del flop</b>, con tus cartas nomás. Habla primero el de la izquierda de la ciega grande y la
              grande habla última: si nadie subió, puede pasar o subir (ya puso la apuesta).
            </li>
            <li>
              <b>Flop:</b> se dan vuelta 3 cartas en la mesa.
            </li>
            <li>
              <b>Turn:</b> la cuarta.
            </li>
            <li>
              <b>River:</b> la quinta y última.
            </li>
          </Steps>
          <p>
            Desde el flop habla primero el primero que sigue en la mano a la izquierda del botón, y el botón habla
            último. Hablar último es una ventaja: decidís sabiendo qué hicieron los demás.
          </p>
          <p>
            Una ronda termina cuando todos los que siguen pusieron lo mismo (o pasaron). Si en algún momento quedan todos
            ido menos uno, ese gana el pozo sin mostrar.
          </p>
          <Tip>
            Mano a mano: antes del flop el botón (ciega chica) habla primero; desde el flop, último.
          </Tip>
        </>
      ),
    },
    {
      title: "Cuánto se puede apostar",
      summary: "Sin límite y límite del pozo",
      practice: { drill: "potOdds", label: "Practicar: ¿Call o fold?" },
      body: () => (
        <>
          <H>Sin límite (no limit)</H>
          <List>
            <li>
              La apuesta mínima es la <b>ciega grande</b>.
            </li>
            <li>
              Para subir tenés que subir <b>al menos lo mismo que la última subida</b>. Si apostaron $200 y otro subió a
              $600 (subió $400), el siguiente tiene que subir a $1.000 o más.
            </li>
            <li>
              El máximo son todas tus fichas: el <b>all-in</b>.
            </li>
          </List>
          <H>Límite del pozo (pot limit)</H>
          <p>
            Igual que sin límite, pero lo más que podés subir es <b>lo que habría en el pozo después de pagar</b>. Si en
            el pozo hay $1.000 y te apuestan $500: pagás $500 (el pozo queda en $2.000) y podés subir $2.000 más, o sea a
            $2.500.
          </p>
          <Tip>
            En los casinos el Hold&apos;em se juega casi siempre sin límite y el Omaha casi siempre con límite del pozo.
            La Mesa de práctica juega los tres juegos sin límite.
          </Tip>
        </>
      ),
    },
    {
      title: "All-in y pozo aparte",
      summary: "Cuando alguien no tiene fichas para pagar",
      body: () => (
        <>
          <p>
            Si te apuestan más de lo que tenés, podés pagar con todo lo que te queda: vas <b>all-in</b>. Nadie te puede
            sacar de la mano por falta de fichas, pero <b>solo jugás por lo que pusiste</b>.
          </p>
          <H>El pozo aparte</H>
          <p>Lo que los demás apuesten de más se arma en otro pozo, que se juegan solo entre ellos.</p>
          <div className="rounded-xl bg-muted p-3 text-sm">
            Ana va all-in con $500. Beto y Caro pagan $1.500 cada uno.
            <List>
              <li>
                <b>Pozo principal:</b> $500 de cada uno = $1.500. Lo pueden ganar los tres.
              </li>
              <li>
                <b>Pozo aparte:</b> los $1.000 de más de Beto y Caro = $2.000. Solo entre ellos dos.
              </li>
            </List>
            Si Ana tiene la mejor mano, gana el principal, y el aparte se lo lleva el mejor entre Beto y Caro.
          </div>
          <H>All-in que no alcanza a ser subida</H>
          <p>
            Si alguien va all-in por menos que una subida completa, los que ya habían hablado solo pueden pagar la
            diferencia: <b>no se reabre la subida</b> para ellos.
          </p>
        </>
      ),
    },
    {
      title: "Mostrar las cartas",
      summary: "Quién muestra primero y cómo se reparte",
      practice: { drill: "whoWins", label: "Practicar: ¿Quién gana?" },
      body: () => (
        <>
          <p>
            Si después del river quedan dos o más en la mano, se muestran las cartas y gana la mejor jugada de 5 cartas,
            con las reglas de cada juego.
          </p>
          <H>Quién muestra primero</H>
          <List>
            <li>
              El que hizo la <b>última apuesta o subida</b> en el river.
            </li>
            <li>Si en el river pasaron todos, el primero a la izquierda del botón.</li>
            <li>
              Los demás muestran en orden; el que ve que perdió puede tirar sus cartas sin mostrarlas. Las que se
              muestran, hablan solas: aunque alguien diga mal su jugada, vale lo que está en la mesa.
            </li>
          </List>
          <H>Empates</H>
          <p>
            Si dos tienen exactamente la misma jugada de 5 cartas, se reparten el pozo. Los palos no desempatan. Si la
            plata no se puede dividir justo, la ficha que sobra va al primero de los ganadores a la izquierda del botón.
          </p>
          <Example hole="Ah Qd" board="Ks Kd 7c 7h 2s">
            Doble par K y 7 con As. Si el otro tiene A-J, también tiene K-K-7-7-A: <b>reparten</b>, la Q no cuenta
            porque ya son 5 cartas.
          </Example>
        </>
      ),
    },
    {
      title: "Con qué manos entrar",
      summary: "Qué manos jugar antes del flop",
      practice: { drill: "preflop", label: "Practicar: Abrir (ciegas)" },
      body: () => (
        <>
          <p>
            La mayoría de las manos se tiran antes del flop. Cuanto más cerca del botón estás, más manos podés jugar,
            porque hablás después que los demás en todas las rondas.
          </p>
          {picker}
          <PreflopRanges variant={variant} />
          <OmahaPrinciples variant={variant} />
        </>
      ),
    },
    {
      title: "Cómo jugamos nosotros: con luz",
      summary: "Las reglas de la casa en La Cajita",
      practice: { drill: "luz", label: "Practicar: Con luz" },
      body: () => (
        <>
          <p>
            En La Cajita no hay ciegas: se juega con <b>luz</b>. Todo lo demás (las jugadas, cómo se arma la mano en
            cada juego, el all-in, mostrar las cartas) es igual que en las lecciones anteriores.
          </p>
          <H>La luz</H>
          <List>
            <li>
              <b>Antes de repartir</b>, cada uno decide si entra a la mano. Los que entran ponen la luz; los que no,
              no reciben cartas.
            </li>
            <li>
              La luz es <b>la misma para todos durante toda la noche</b>.
            </li>
            <li>
              La luz va al pozo pero no es una apuesta: antes del flop <b>se puede pasar</b>.
            </li>
          </List>
          <H>Quién habla primero</H>
          <List>
            <li>
              Siempre arranca <b>la mano</b>: el primero a la izquierda del que reparte (entre los que entraron).
            </li>
            <li>
              Cuando alguien apuesta, en las rondas siguientes <b>habla primero él</b>, hasta que otro apueste o le
              suba: ahí pasa a hablar primero ese.
            </li>
            <li>Si el que tiene que hablar primero se fue o está all-in, habla el siguiente a su izquierda.</li>
          </List>
          <div className="rounded-xl bg-muted p-3 text-sm">
            Antes del flop pasan Ana y Beto, y Caro apuesta. En el flop habla primero <b>Caro</b>. Si en el flop pasan
            todos, en el turn sigue hablando primero Caro. Si en el turn Ana apuesta, en el river habla primero{" "}
            <b>Ana</b>.
          </div>
          <H>Cuánto se apuesta</H>
          <List>
            <li>
              <b>Sin límite</b>, en los tres juegos.
            </li>
            <li>
              La apuesta mínima es <b>la luz</b>. Para subir, al menos lo mismo que la última subida.
            </li>
          </List>
          <H>Las cajitas</H>
          <List>
            <li>Cada uno arranca con una cajita de fichas.</li>
            <li>
              Otra cajita se pide <b>entre manos, nunca durante una</b>, y solo cuando te queda <b>un cuarto de la
              cajita o menos</b>.
            </li>
          </List>
          <H>Quemar cartas</H>
          <p>
            Se quema una carta antes del flop, del turn y del river <b>cuando alcanzan las cartas</b>. Por ejemplo, en
            Manhattan Short con 6 jugadores se reparten 30 cartas y quedan 6: alcanzan para la mesa pero no para quemar.
          </p>
        </>
      ),
    },
  ]
}
