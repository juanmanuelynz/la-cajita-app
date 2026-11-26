# Plan: jugar contra bots

Jugar manos completas solo, contra bots, desde **Entrenar**. Acordado el
25/11/2026. **Todavía no hay código:** esto es lo que se va a construir.

Reemplaza como próximo paso a la mesa online entre el grupo
([plan-mesa-online.md](plan-mesa-online.md)), que queda **en pausa**: lo más
probable es jugar entre nosotros muy de vez en cuando, y para eso alcanza con
una app gratis de fichas de juguete (por ejemplo PokerNow, aunque no tiene
Manhattan y no confirmamos que tenga Short deck). Si el juego online prospera,
se retoma ese plan; el motor de la mano y los bots de acá se reutilizan tal cual.

## Por qué así

- **Corre todo en el celular, como Entrenar.** Sin servidor de mesa, sin PIN
  personal, sin roles, sin actualización en vivo y sin gastar horas de la base.
- **Se apoya en lo que ya hay:** el evaluador (`lib/poker/evaluator.ts`), la
  equity (`lib/poker/equity.ts`), los rangos de PokerStrategy
  (`lib/poker/preflop.ts`, `preflop-vs.ts`) y el diseño de mesa y cartas de
  Entrenar (`RingTable`, `PlayingCard`).
- **Lo que no tiene ninguna otra app:** Manhattan y Short deck con las reglas
  de la casa.

## Decisiones

### Dónde está

- En **Entrenar → Ejercicios**, una entrada nueva **"Mesa de práctica"** (se llamó "Jugar contra bots" hasta el 26/11/2026) arriba
  de todo el menú. Se abre en su propia pantalla con "Volver", y el "atrás" del
  celular la cierra (`useBackToClose`), igual que los ejercicios.

### Armar la mesa

- **Juego y mazo:** Hold'em, Omaha o Manhattan, en Long o Short. Dos modos:
  **fijo** (el mismo juego toda la sesión) o **se rota** (una ronda de cada
  juego).
- **Cuántos bots:** de 1 a 7 (mesa de hasta 8), según lo que entra en el mazo
  (cartas propias de todos + 5 de la mesa, sin quemar):

  | Mazo | Juego | Máximo |
  |---|---|---|
  | Long (52) | todos | 8 |
  | Short (36) | Hold'em | 8 |
  | Short (36) | Omaha | 7 |
  | Short (36) | Manhattan | 6 |

  Al armar la mesa no deja poner más bots de los que entran; en modo "se rota"
  manda el juego más justo de la rotación. Si se quemaran cartas, Manhattan
  Short bajaría a 5 (a confirmar; el motor lo soporta con una opción).
- **Valor de la cajita** (arranca en $2.000).
- **Con luz o con ciegas:** con luz (arranca en $100), como en La Cajita; con
  ciegas (arrancan en $100 la chica y $200 la grande), sin luz. Todo en
  múltiplos de $100.

### Reglas

Las mismas que la mesa online:

- **Con luz:** igual para todos, sin ciegas. Habla primero el de la izquierda del
  que reparte y el que reparte habla último. Si nadie apostó, se puede pasar.
- **Con ciegas:** la chica la pone el de la izquierda del que reparte y la
  grande el siguiente. Antes del flop habla primero el de la izquierda de la
  grande y la grande última (si nadie subió, puede pasar o subir). Después del
  flop, como con luz. Mano a mano, el que reparte pone la chica.
- **Sin límite.** La subida mínima es igual a la última subida.
- **All-in con pozos laterales.**
- **Juegos** con las reglas de la casa del evaluador. Manhattan se juega como
  Omaha (flop, turn y river), con 5 cartas propias de las que se usan 2 o 3.
- **Cajitas:** cada una suma su valor en fichas. Se puede pedir otra cuando te
  queda **una cuarta parte de la cajita o menos**; entra antes de la mano
  siguiente. Los bots piden solos cuando se quedan sin fichas.
- **Sin reloj:** jugás a tu ritmo.

### Plata y progreso

- **Es de práctica:** no se anota en ningún lado (ni partida, ni suelta, ni
  ranking).
- La sesión se guarda en el celular (localStorage): si cerrás la app, al volver
  seguís en la misma mano.
- Al terminar, un resumen: manos jugadas, cajitas pedidas y cómo terminaste.

### Bots

- **Deciden igual en todos los juegos y calles, como "Con luz":** simulan su
  equity contra los que siguen en la mano (con cartas al azar: no ven las de
  nadie) y la comparan con lo que tienen que pagar (pot odds). Apuestan cuando
  están bastante por encima de lo que les toca, pagan si les alcanza y se
  retiran si no. Nunca se retiran si pueden pasar gratis.
- **Excepción: con ciegas, en Hold'em Long y de 4 a 6 jugadores**, antes del
  flop siguen los rangos de PokerStrategy que ya usa Entrenar: abrir si nadie
  entró, y con 6, pagar o resubir contra una subida y contestar a una resubida.
  Con 4 o 5 se sacan las primeras posiciones, como en Entrenar (adaptación
  nuestra). Los tamaños para resubir (3× la subida, 2,5× la resubida) son
  nuestros. Con luz los rangos no se usan: son para mesas con ciegas.
- Todo lo demás es lógica nuestra, sin fuente, medida con simulaciones (ver
  "Cuánto le gana cada nivel al otro"). Cada decisión dice de dónde sale
  (`source`). Hasta el 26/11/2026 los bots llevaban la etiqueta **Beta**; se
  sacó a pedido, con los niveles ya medidos.
- **Leen lo que apostás** (26/11/2026): quien apuesta o sube no tiene una mano
  cualquiera. Para cada rival, el bot achica sus manos posibles según lo que
  hizo en la mano (`keepFor`: subir antes del flop deja el 35% de arriba,
  pagar el 70%; después del flop apostar deja el 45% y pagar el 70%; lo de
  calles anteriores pesa a medias) y en la simulación le reparte solo manos de
  esa parte. "La parte de arriba" se mide antes del flop en Hold'em con la
  equity de cada mano contra 2 al azar (las mismas tablas del "¿Abrís?" Beta)
  y después del flop con la mano hecha que arma con la mesa. Una parte de las
  veces (`bluffMix`) igual le da una mano cualquiera, para contar bluffs y
  proyectos. En Omaha y Manhattan, antes del flop, no se achica (no hay tabla).
  Los factores son nuestros, sin fuente.
- **Piden otra cajita solo cuando se quedan sin fichas.**

### Niveles

Los rivales se eligen al armar la mesa: por defecto, **según tu nivel de
Entrenar** (la misma dificultad de los ejercicios: Fácil 1–3, Media 4–6,
Difícil 7 o más), y se puede cambiar. Cada nivel tiene sus apodos (personajes,
no gente del grupo); el nivel va en el id del asiento, así la mesa guardada
sabe cómo juega cada uno.

| Nivel | Cómo juega | La lección | Apodos |
|---|---|---|---|
| **Fácil** | Paga casi todo (hasta 8 puntos menos de lo que necesita), casi no bluffea (3%), no lee rangos ni sigue los de PokerStrategy, y se le lee el tamaño: chico con manos medias, grande con monstruos | Apostale tus buenas manos y no lo bluffees | El Turista, Doña Rosa, El Optimista, Pagador Serial, El Curioso, Tío Pocho, La Esperanza |
| **Media** | El bot de siempre, pero lee a medias lo que le apuestan; el tamaño sigue a la mano | — | El Contador, La Profe, El Ingeniero, Rulo, La Paciente, El Gringo, Toto |
| **Difícil** | Lee rangos completos, apuesta con proyectos en el flop y el turn, bluffea más con posición y apuesta lo mismo con valor y con bluff | No le podés leer la mano por el tamaño | La Calculadora, El Mudo, La Víbora, El Frío, Mister GTO, La Esfinge, El Relojero |
| **Nano** (final boss) | Difícil, y además **te estudia** en la mesa: si te vas mucho cuando te apuestan (más del 55%), te bluffea más seguido y más barato; si casi nunca te vas (menos del 30%), no te bluffea y te apuesta más fino y más grande con lo bueno; si te vio bluffear al mostrar en el river, te cree menos | Que no te lean: variá | Nano |

- **Nano se desbloquea en el nivel 9 (Leyenda):** al armar la mesa aparece
  "Desafiar a Nano" y se sienta con los demás bots. Antes no se muestra nada
  (es una sorpresa). Al
  terminar la mesa se dice si le ganaste.
- Lo que Nano aprende de vos (`PlayerReads`) es solo lo que vería un jugador:
  lo que hiciste y las cartas que mostraste. Necesita 6 veces que te hayan
  apostado (y 3 apuestas tuyas en el river que se vieron) antes de sacar
  conclusiones. Se guarda con la mesa y se borra al armar otra.
- En "Ver cómo pensaron los bots", Nano dice cuándo te explotó ("te vio irte
  el 70% de las veces que te apostaron").
- **Para no ser previsibles:** bluffean a veces (solo contra 1 o 2), juegan
  lento una mano muy buena y el tamaño de la apuesta varía. Las frecuencias de
  cada nivel están en `BOT_PROFILES`.

### Cuánto le gana cada nivel al otro (medido)

`npx tsx scripts/lab/bot-levels.ts 1500 80 <semilla>` (unos 7 minutos por
semilla). Mesas de 6 solo de bots, 3 de cada tipo en asientos alternados, con
luz, 1.500 manos; se mide cuánto gana cada tipo en **luces cada 100 manos**.
Promedio de 4 semillas (1 a 4), Hold'em Long, 80 simulaciones por decisión:

| Par | Gana el primero | Semillas a favor |
|---|---|---|
| Media nueva vs **el bot anterior** | +141 | 4 de 4 |
| Difícil vs el bot anterior | +143 | 4 de 4 |
| Fácil vs el bot anterior | −123 | 1 de 4 (es el más flojo, a propósito) |
| Media vs Fácil | +228 | 4 de 4 |
| Difícil vs Media | +32 | 3 de 4 (la otra, empate: −1,5) |
| Difícil vs Fácil | +264 | 4 de 4 |
| Nano vs Difícil | −6 | 2 de 4: contra quien no tiene tendencias marcadas juega igual que Difícil |
| Fácil vs azar / vs pagador | +368 / +572 | 4 de 4 |

Lo que agrega Nano se ve contra jugadores con tendencias (mismo método):

| Rival | Difícil | Nano |
|---|---|---|
| Pagador (paga todo) | +574 | **+758** (4 de 4 arriba) |
| Maníaco (apuesta el pozo con cualquier cosa) | +621 | +647 |
| Miedoso (se va el 70%) | +106 | +110 |

Omaha Long (1.000 manos) y Manhattan Short (800 manos, 60 simulaciones), 2
semillas: Media le gana a Fácil +180 y +243 (todas a favor); Difícil vs Media
da +36 en Omaha (2 de 2) y +12 en Manhattan (1 de 2: no alcanza para decir
que sea mejor ahí, y antes del flop en esos juegos no lee rangos).

"El bot anterior" es la versión del commit 9941a20, medida una vez con una
copia temporal (no quedó en el repo). Lo que se ajustó mirando estos números:
Difícil lee rangos completos (con lectura a medias perdía con Media: −31),
le da menos manos al azar a quien apuesta (12%) y sube con menos fuerza. Los
bots no se leen el tamaño entre ellos: lo de "apostar parejo" de Difícil no
se ve en estos números, es contra personas.

- **Son bots de práctica:** juegan razonable y cada nivel tiene sus agujeros a
  propósito. Un bot fuerte de verdad (que resuelva el juego) es otro proyecto.

### Para aprender (opcional, al final)

- **Repaso de la mano:** al terminar cada mano, ver en cada calle tu equity
  contra lo que pagaste, con el mismo lenguaje de "¿Call o fold?" (pot odds).

## Cómo se construye

En este orden. Cada paso se puede probar solo antes de seguir.

1. ✅ **Motor de la mano** (`lib/poker/table.ts`, con tests en
   `tests/table.test.ts`; hecho el 25/11/2026). Código puro:
   luz, orden de habla, el botón que rota, pasar, apostar, pagar, subir,
   retirarse, all-in, pozos laterales, reparto según el juego, quién gana y
   cajitas. Tests con manos armadas a mano: pozos laterales con tres all-in
   distintos, pozos repartidos, subida mínima, Short deck y pedir cajita.
   Es el mismo motor que usaría la mesa online si se retoma.
2. ✅ **Bots** (`lib/poker/bot.ts`, tests en `tests/bot.test.ts`; hecho el
   25/11/2026). Tests de sentido común: nunca se retira si puede pasar gratis,
   nunca se retira con la mejor mano posible, sus apuestas siempre son
   válidas y una mesa solo de bots juega manos enteras sin perder fichas.
3. ✅ **Pantalla** (`components/training/bot-table.tsx`; hecho el 25/11/2026): armar la mesa, la
   mesa ovalada con `RingTable` y las cartas de Entrenar, pozo, fichas de cada
   uno, quién habla, tus botones (pasar, pagar, subir con montos rápidos tipo
   medio pozo / pozo / all-in, retirarse) y la jugada de cada bot con una pausa
   corta para poder seguirla.
4. ✅ **Niveles, apodos y Nano** (26/11/2026): leer rangos, cuatro niveles
   según tu nivel de Entrenar, Nano que se adapta, y el estudio
   `scripts/lab/bot-levels.ts`. Tests en `tests/bot.test.ts`.
5. **Repaso de la mano** (opcional): el resumen por calle.

## Riesgos

- **Velocidad en el celular:** la equity de Manhattan contra varios rivales se
  calcula simulando manos y puede tardar. Hay que darle a cada bot un tope de
  simulaciones (como ya hace "Con luz": 1.200 en Manhattan) y, si igual se
  traba, pasar el cálculo a un Web Worker para que la pantalla no se congele.
- **Los bots se van a sentir "robots":** es esperable con reglas simples.
  Ajustar el azar después de probarlos, no antes.
- **Pozos laterales:** es la parte del motor más fácil de hacer mal; por eso
  va con los tests más cuidadosos.
