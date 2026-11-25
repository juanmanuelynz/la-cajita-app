# Motor de Entrenar

Guía del motor de póker que usa la pestaña **Entrenar**: qué hace cada parte, de
dónde salen los números y cómo agregar un ejercicio. Actualizada el 25/11/2026.

Todo el motor corre en el celular (son cuentas, no hay servidor de por medio).
Lo único que toca la base de datos es el progreso: cada respuesta y el resultado
del Desafío del día.

## Juegos y reglas de la casa

| Juego | Cartas propias | Cómo se arma la mano |
|---|---|---|
| Hold'em | 2 | Las 5 mejores entre tus 2 y las 5 de la mesa, como quieras |
| Omaha | 4 | Sí o sí 2 de tu mano y 3 de la mesa |
| Manhattan | 5 | 2 de tu mano con 3 de la mesa, o 3 de tu mano con 2 de la mesa |

Cada juego se puede jugar con mazo **Long** (52 cartas) o **Short** (36, sin 2 a 5).
Reglas de la casa en Short:

- El **color le gana al full**.
- La **escalera le gana al trío** (como en Long).
- La escalera más baja es **A-6-7-8-9**.

Están en `lib/poker/evaluator.ts` y los tests las verifican.

## Mapa de archivos

| Archivo | Qué hace |
|---|---|
| `lib/poker/cards.ts` | Cartas como números (`(rango − 2) × 4 + palo`), mazos, mezclar, semilla fija |
| `lib/poker/variants.ts` | Los 3 juegos y los 2 mazos |
| `lib/poker/evaluator.ts` | Puntaje de una mano de 5 cartas y mejor mano según el juego |
| `lib/poker/equity.ts` | Qué parte del pozo se lleva cada mano: exacta (recorre todas las mesas) o simulada; outs |
| `lib/poker/drills.ts` | Generadores de los ejercicios de cartas |
| `lib/poker/gto.ts` | Fórmulas del river: MDF, alfa, parte de bluffs |
| `lib/poker/ev.ts` | Ejercicios de valor esperado (¿Apostar o pasar?, Defender contra proyectos, ¿All-in o fold?, ¿Qué le queda?) |
| `lib/poker/preflop.ts` | Rangos de apertura con ciegas (PokerStrategy) |
| `lib/poker/preflop-vs.ts` + `preflop-vs-data.ts` | Pagar / resubir cuando te suben (PokerStrategy) |
| `lib/poker/preflop-beta.ts` + `preflop-beta-data.ts` | Apertura **Beta** para los juegos sin fuente |
| `lib/poker/difficulty.ts` | Dificultad según el nivel (Fácil 1–3, Media 4–6, Difícil 7+) |
| `lib/poker/drill-ids.ts` | La lista de ejercicios (la única) |
| `lib/poker/training.ts` | Nombres, consejos, Desafío del día, niveles, puntos débiles |
| `components/training/` | Las pantallas de cada ejercicio |
| `components/tabs/entrenar-tab.tsx` | El menú de ejercicios (grupos) y la pantalla de cada uno |
| `scripts/lab/` | Estudios: cuánto difieren los números entre juegos |
| `tests/poker.test.ts` | Tests del motor |

Todas las funciones del motor son puras y reciben el azar (`rng`) de afuera: con
la misma semilla dan siempre lo mismo. Así se testean y así todo el grupo recibe
el mismo Desafío.

## Los ejercicios y de dónde salen sus números

Nivel de confianza (el mismo del [playbook](playbook-daily-dose-gto.md)):

- **Exacto**: cuenta o fórmula sin error.
- **Simulado**: miles de manos al azar; error de 1 a 2 puntos.
- **Fuente**: copiado de una fuente publicada; los tests verifican que coincida.
- **Beta**: inferido por nosotros, con la etiqueta Beta en la app.

| Ejercicio (id) | Grupo | Juegos | Números | Desafío |
|---|---|---|---|---|
| ¿Qué tenés? (`usable`) | Leer la mano | Todos | Exacto | Sí |
| ¿Quién gana? (`whoWins`) | Leer la mano | Todos | Exacto | Sí |
| ¿Cuál es mejor? (`compare`) | Leer la mano | Todos | Simulado | Sí |
| Con luz (`luz`) | Antes del flop | Todos | Simulado (la cuenta de pagar es exacta) | Sí |
| Abrir (ciegas) (`preflop`) | Antes del flop | Hold'em Long: Fuente; el resto: Beta | Fuente / Beta | Sí |
| Te suben / Te resuben (`preflopVs`) | Antes del flop | Solo Hold'em Long | Fuente | No |
| Outs (`outs`) | Pagar o no | Todos | Exacto | Sí |
| ¿Call o fold? (`potOdds`) | Pagar o no | Todos | Exacto | Sí |
| ¿All-in o fold? (`shove`) | Pagar o no | Igual en todos | Exacto (contado en 10 all-ins) | Desde 26/11 |
| GTO river (`gto`) | Cuentas GTO | Igual en todos | Exacto | Desde 25/11 |
| ¿Apostar o pasar? (`betOrCheck`) | Cuentas GTO | Igual en todos | Exacto | Desde 26/11 |
| Defender proyectos (`semiBluff`) | Cuentas GTO | Igual en todos | Exacto | Desde 26/11 |
| ¿Qué le queda? (`callDown`) | Cuentas GTO | Igual en todos | Exacto | No (Beta) |

Fuentes:

- **PokerStrategy.com**, lecciones de 6-max: rangos de apertura y de pagar o
  resubir. Los tests verifican cada rango contra la cantidad de combinaciones
  que publica la fuente. Para mesas de 4 y 5 jugadores la adaptación es nuestra
  (se sacan los primeros lugares) y la app lo dice.
- **"Daily Dose of GTO"** (GTO Wizard): ideas de los ejercicios de valor
  esperado. Solo usamos la matemática; los tests verifican los ejemplos del
  libro. Detalle en el [playbook](playbook-daily-dose-gto.md).
- **Beta**: equity de cada mano contra 2 manos al azar, generada con
  `npx tsx scripts/gen-preflop-beta.ts` (no editar los datos a mano).

Regla del proyecto: **no se inventan números**. Lo que se lleva de Hold'em a
otro juego tiene que tener el error medido (`scripts/lab/`) o la etiqueta Beta.

## El Desafío del día

- 10 preguntas iguales para todo el grupo: salen de una semilla armada con la
  fecha (`dailyChallenge` en `training.ts`).
- Sortea ejercicio, juego y mazo. Nunca usa la dificultad por nivel.
- **Los días pasados tienen que dar siempre las mismas preguntas** (se pueden
  volver a ver). Por eso cada ejercicio nuevo entra desde una fecha
  (`GTO_IN_DAILY_FROM`, `EV_IN_DAILY_FROM`) y va **al
  final** de la lista de ejercicios. Usar una fecha que todavía no llegó (mañana
  o después), así nadie lo jugó con otras preguntas.
- Los ejercicios en `BETA_DRILLS` (hoy ¿Qué le queda?) no entran nunca; en el
  menú llevan la etiqueta Beta.

## Cómo agregar un ejercicio

TypeScript y los tests avisan si falta alguno de los pasos marcados con ✔︎.

1. **Generador**: una función `make…(variant, rng)` pura, en `lib/poker/` (en
   `drills.ts` si usa cartas, en `ev.ts` si es una cuenta). La plata siempre en
   múltiplos de $100.
2. **Lista**: agregar el id **al final** de `DRILL_IDS` en
   `lib/poker/drill-ids.ts`. Si vale igual en todos los juegos, sumarlo también
   a `GAME_FREE_DRILLS` (no muestra el selector de juego ni usa dificultad,
   salvo ¿All-in o fold? y ¿Apostar o pasar?, que sí la usan: ver `NO_DIFFICULTY`). La
   validación del servidor y la dificultad leen de acá.
3. **En `training.ts`**:
   - ✔︎ Nombre en `DRILL_NAMES` y consejo en `DRILL_TIPS`.
   - ✔︎ Generador en `MAKERS`.
   - Tipo en `DailyQuestion`.
   - Fecha de entrada al Desafío (constante `…_IN_DAILY_FROM` y filtro en
     `dailyDrills`), o sacarlo del Desafío como `preflopVs`.
   - Calle: en `FIXED_STREET` si es siempre la misma; si no, en `answerContext`.
4. **Pantalla**: el componente en `components/training/`, con `useDrill` y
   `DrillShell` (`drill-shell.tsx`).
5. **Menú**: la tarjeta en `GROUPS` y la línea que lo muestra, en
   `components/tabs/entrenar-tab.tsx`.
6. ✔︎ **Desafío**: el `case` en `Question` de `components/training/daily-challenge.tsx`.
7. **Tests** en `tests/poker.test.ts`:
   - Las opciones son distintas y la respuesta está entre ellas.
   - Si viene de una fuente, sus ejemplos dan.
   - El Desafío de los días anteriores no cambia.
8. Correr `npm test`, `npm run lint` y mirarlo en el celular.

## Laboratorio

`scripts/lab/` tiene estudios que se pueden repetir (semilla fija) para saber
cuánto se puede confiar en llevar un número de Hold'em a nuestros juegos.
Resultados y cómo leerlos en el [playbook](playbook-daily-dose-gto.md) (sección "Laboratorio").

| Script | Qué mide | Tipo |
|---|---|---|
| `holdem-transfer.ts` | Error de usar la equity de Hold'em en Omaha y Manhattan | Simulado |
| `flop-textures.ts` | Qué flops salen más en Long y en Short | Exacto |
| `blockers.ts` | Cuánto bloquea tener una carta clave, por juego | Exacto |
| `multiway.ts` | Qué manos ganan con 4 jugadores, por juego | Simulado |

Se corren con `npx tsx scripts/lab/<script>.ts`.
