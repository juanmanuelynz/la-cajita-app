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

- En **Entrenar → Ejercicios**, una entrada nueva **"Jugar contra bots"** arriba
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
- Todo lo demás es lógica nuestra, sin fuente: en esos casos los bots llevan la
  etiqueta **Beta**. Cada decisión dice de dónde sale (`source`).
- **Para no ser previsibles:** bluffean a veces (10%, solo contra 1 o 2), juegan
  lento una mano muy buena (15%) y el tamaño de la apuesta varía.
- Piden otra cajita solo cuando se quedan sin fichas.
- **Prueba de sentido común** (300 manos por juego, 120 simulaciones por
  decisión): en Hold'em, Omaha y Manhattan Short les ganan plata a un jugador
  que decide al azar y a uno que paga todo. Cada decisión tarda 10–25 ms.
- **Son bots simples:** juegan razonable pero se dejan leer. Un bot fuerte es
  otro proyecto.

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
4. **Repaso de la mano** (opcional): el resumen por calle.

## Riesgos

- **Velocidad en el celular:** la equity de Manhattan contra varios rivales se
  calcula simulando manos y puede tardar. Hay que darle a cada bot un tope de
  simulaciones (como ya hace "Con luz": 1.200 en Manhattan) y, si igual se
  traba, pasar el cálculo a un Web Worker para que la pantalla no se congele.
- **Los bots se van a sentir "robots":** es esperable con reglas simples.
  Ajustar el azar después de probarlos, no antes.
- **Pozos laterales:** es la parte del motor más fácil de hacer mal; por eso
  va con los tests más cuidadosos.
