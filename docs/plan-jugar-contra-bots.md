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
- **Cuántos bots:** de 1 a 7 (mesa de hasta 8).
- **Valor de la cajita** (arranca en $2.000) y **luz** (arranca en $100), como en
  una partida de verdad.

### Reglas

Las mismas que la mesa online:

- **Luz** igual para todos, sin ciegas. Habla primero el de la izquierda del que
  reparte y el que reparte habla último. Si nadie apostó, se puede pasar.
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

- **Hold'em Long, antes del flop:** siguen los rangos de PokerStrategy que ya
  usa Entrenar (abrir, pagar o resubir según la posición).
- **Después del flop, y en Omaha, Manhattan y Short:** comparan la equity de su
  mano contra los que siguen en la mano con lo que tienen que pagar (pot odds),
  y apuestan cuando están adelante. Les sumamos un poco de azar (algún bluff,
  algún slowplay) para que no sean 100% previsibles.
- Fuera de Hold'em Long es una regla nuestra, sin fuente: los bots llevan la
  etiqueta **Beta**, como el resto de Entrenar cuando no hay fuente.
- **Son bots simples:** juegan razonable pero se dejan leer. Un bot fuerte es
  otro proyecto.

### Para aprender (opcional, al final)

- **Repaso de la mano:** al terminar cada mano, ver en cada calle tu equity
  contra lo que pagaste, con el mismo lenguaje de "¿Call o fold?" (pot odds).

## Cómo se construye

En este orden. Cada paso se puede probar solo antes de seguir.

1. **Motor de la mano** (`lib/poker/table.ts`, nuevo, con tests). Código puro:
   luz, orden de habla, el botón que rota, pasar, apostar, pagar, subir,
   retirarse, all-in, pozos laterales, reparto según el juego, quién gana y
   cajitas. Tests con manos armadas a mano: pozos laterales con tres all-in
   distintos, pozos repartidos, subida mínima, Short deck y pedir cajita.
   Es el mismo motor que usaría la mesa online si se retoma.
2. **Bots** (`lib/poker/bot.ts`, nuevo, con tests). Decisión a partir del estado
   de la mano y las cartas del bot. Tests de sentido común: nunca se retira si
   puede pasar gratis, siempre sigue con la mejor mano posible, en Hold'em Long
   abre según el rango de PokerStrategy.
3. **Pantalla** (`components/training/bot-table.tsx`, nuevo): armar la mesa, la
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
