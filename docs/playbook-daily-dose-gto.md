# Playbook: "Daily Dose of GTO" (GTO Wizard)

Notas nuestras sobre el ebook, para retomarlo en otra sesión ("sigamos con el
playbook de GTO"). Escrito el 25/11/2026.

## Qué es y cómo conseguirlo

- **Daily Dose of GTO**, de GTO Wizard (2024): 334 lecciones cortas, 1293 páginas
  tipo diapositiva, casi todo con capturas del solver.
- Descarga gratis (el host está permitido en el entorno de Claude):
  `https://download.dailydoseofgto.com/book/v3/DailyDoseOfGTO_Book.pdf` (173 MB).
- Juego: No Limit Hold'em mano a mano o 6 jugadores, cash a 100 ciegas, torneos
  (MTT) y Spins. Nada de Omaha, Manhattan ni mazo corto.
- **Copyright © 2024 GTO Wizard. All rights reserved.** El repo es público: no se
  sube el PDF ni su texto, y no se copian sus preguntas, explicaciones ni
  imágenes. Sí se usan las ideas y la matemática (que no tiene dueño), con
  números y preguntas nuestras. El índice de lecciones (número, capítulo y
  título) está en [playbook-daily-dose-gto-indice.md](playbook-daily-dose-gto-indice.md).

## Lo que ya usamos

| Lección | Idea | Dónde está |
|---|---|---|
| 8, 26, 305 | Pot odds, MDF y alfa | ¿Call o fold?, GTO river (ya existían) |
| 51 | Sumar el EV de cada respuesta del rival para decidir apostar o pasar | ¿Apostar o pasar? |
| 130, 131 | Si el bluff tiene chances (showdown o proyecto), alcanza con defender menos que la MDF | Defender contra proyectos |
| 137 | All-in con pocas fichas: los folds bajan lo que tenés que ganar | ¿All-in o fold? (con luz) |
| 44, 149 | Las pot odds mandan sobre la MDF: contra quien farolea poco, fold | Aviso en "Ver por qué" |
| 210, 325 | Tres apuestas seguidas: lo que paga todo es el producto de las MDF, y las manos que no foldean pasan a ser casi todo | ¿Qué le queda? (en el Desafío desde el 27/11) |

Fórmulas y tests: `lib/poker/ev.ts` y `tests/poker.test.ts` (verifican los
ejemplos numéricos del libro).

## Qué más sirve, según cuánto se puede confiar

Usamos cuatro niveles. Todo lo que mostremos en la app tiene que decir en qué
nivel está (como hoy la etiqueta **Beta**).

1. **Exacto**: matemática que vale igual en Hold'em, Omaha y Manhattan, largo o
   corto (pozo, apuesta, probabilidades). Se puede usar tal cual.
2. **Medido**: lo calculamos con nuestro motor (`lib/poker/equity.ts`) para cada
   juego y mazo. No es una opinión: es una simulación que se puede repetir.
3. **Adaptado**: una regla de Hold'em llevada a otro juego, **con el error
   medido** (ver "Laboratorio" abajo). Si el error es grande, no se usa.
4. **Sin fuente**: rangos o frecuencias que en el libro salen del solver. Para
   nuestros juegos no hay solver, así que no se inventan.

### 1. Exacto (pendientes)

| Lección | Idea | Ejercicio posible |
|---|---|---|
| 34 | Con una apuesta de ~162% del pozo (número de oro) MDF y pot odds dan lo mismo (38%) | Dato curioso para "Ver por qué" de GTO |
| 40 | El EV se mide contra hacer fold | Explicación en los ejercicios de EV |
| 150, 151 | Juegos de juguete (A-K-Q, números de 0 a 1) para entender bluffs y valor | Explicación interactiva, no ejercicio |
| 146, 147 | Riesgo de quebrar y criterio de Kelly (cuánto arriesgar de lo que tenés) | Solo si algún día nos sirve para el pozo del grupo |

### 2. y 3. Para medir o adaptar a nuestros juegos

Conceptos del libro que valen como idea, pero cuyos números son de Hold'em:

- **Bloqueadores** (21, 24, 89–91): en Omaha y Manhattan pesan mucho más (tenés 4
  o 5 cartas). Se puede contar exacto cuántas combinaciones del rival bloqueás.
- **Manos que ganan con más jugadores** (64, 311): simular equity a 3 o 4 manos
  por juego.
- **Realización de equity, cubetas y distribuciones** (15, 22, 23, 153–181): la
  forma de la distribución de equity (polarizada o pareja) se puede calcular con
  nuestro motor para cada juego.
- **Texturas y palos** (35, 39, 61, 100): qué tan seguido el que va adelante en el
  flop sigue adelante en el river, según la textura y el juego.
- **Preflop** (2, 94, 98): ya tenemos la Beta por equity contra 2 manos al azar
  (`lib/poker/preflop-beta.ts`).

### 4. No aplica (no lo usamos)

Frecuencias concretas del solver (capítulos Spots, Streets, Tactics, Offense,
Defense, Cash, Spins, MTT, Stack depth), ICM y premios de torneo (134, 142, 262,
295…), rake (286) y straddle (135, 199, 253).

## Laboratorio: cuánto se equivoca pensar "como en Hold'em"

Scripts en `scripts/lab/`. Cada uno usa una semilla fija y se puede repetir.

### Estudio 1: la equity de Hold'em en Omaha y Manhattan

`npx tsx scripts/lab/holdem-transfer.ts 200 2026` (unos minutos).

Método: 200 situaciones de Hold'em mano a mano por fila (flop o turn) con su
equity exacta. Cada mano se completa con cartas al azar hasta tener 4 (Omaha) o
5 (Manhattan), conservando las 2 de Hold'em, y se calcula la equity real en ese
juego (4 manos completadas por situación, promediadas). Error = real − Hold'em,
en puntos de porcentaje.

Situaciones por fila: 200 · manos completadas por situación: 4 · semilla 2026

| Juego | Mazo | Calle | Error medio (pts) | 9 de 10 errores menores a | Cambia «pago el pozo» | Cambia quién va adelante | El que va adelante: Hold'em → real |
|---|---|---|---|---|---|---|---|
| Omaha | Long | flop | 20.4 | 33.8 | 30% | 29% | 78.8% → 59.4% |
| Omaha | Long | turn | 23.7 | 44.4 | 30% | 24% | 85.7% → 63.6% |
| Manhattan | Long | flop | 22.3 | 41.1 | 36% | 32% | 79.5% → 59.1% |
| Manhattan | Long | turn | 28.5 | 51.8 | 32% | 32% | 86.4% → 58.9% |
| Omaha | Short | flop | 14.3 | 27.1 | 24% | 27% | 70.3% → 58.8% |
| Omaha | Short | turn | 21.4 | 39.4 | 26% | 26% | 78.8% → 59.7% |
| Manhattan | Short | flop | 17.0 | 34.8 | 25% | 35% | 70.5% → 56.6% |
| Manhattan | Short | turn | 27.0 | 49.4 | 38% | 43% | 77.7% → 53.9% |

Cómo leerlo:

- **Error medio**: si usás la equity de Hold'em, en promedio le errás por 14 a 28
  puntos (por ejemplo, creés que ganás el 60% y en realidad es 35% u 85%).
- **Cambia «pago el pozo»**: en 1 de cada 3 o 4 situaciones, la decisión de
  pagar una apuesta del pozo (hace falta 33%) cambia.
- **Cambia quién va adelante**: en 1 de cada 3 o 4, la mano que va adelante en
  Hold'em va atrás con las cartas extra.
- **El que va adelante**: en Omaha y Manhattan las manos corren mucho más
  parejas. El que gana el 80–86% en Hold'em queda en 54–64%.

Conclusión: **la equity de Hold'em no sirve como número para Omaha ni Manhattan**
(error de más de 10 puntos en casi todas las filas). Lo que sí se puede llevar
son las fórmulas exactas (pot odds, MDF, EV), con la equity calculada para el
juego que se juega, que es lo que ya hacen los ejercicios. Cuidado al leerlo: el
estudio supone que las cartas extra son al azar; en una mano real se juega con
manos elegidas, así que es una medida de cuánto pesan las cartas que no son "las
de Hold'em", no un error exacto para cada mano.

### Estudio 2: qué flops salen (exacto, lección 127)

`npx tsx scripts/lab/flop-textures.ts` (segundos). Cuenta todos los flops
posibles; no depende del juego.

Todos los flops posibles, contados uno por uno.

| Flop | Long (52 cartas) | Short (36 cartas) |
|---|---|---|
| Tres palos distintos · Sin par | 31.1% | 28.2% |
| Tres palos distintos · Con par | 8.5% | 12.1% |
| Tres palos distintos · Trío | 0.2% | 0.5% |
| Dos del mismo palo · Sin par | 46.6% | 42.4% |
| Dos del mismo palo · Con par | 8.5% | 12.1% |
| Los tres del mismo palo · Sin par | 5.2% | 4.7% |
| **Total sin par** | 82.8% | 75.3% |
| **Total con par** | 16.9% | 24.2% |
| **Total trío** | 0.2% | 0.5% |
| **Total tres palos distintos** | 39.8% | 40.8% |
| **Total dos del mismo palo** | 55.1% | 54.5% |
| **Total tres del mismo palo** | 5.2% | 4.7% |
| Sin par y los 3 rangos entran en una escalera (alguien puede tenerla ya) | 18.5% | 35.9% |

Flops posibles: 22100 en Long, 7140 en Short.

Cómo leerlo:

- En los dos mazos el flop más común es **dos del mismo palo y sin par** (47% y
  42%), y el de **tres del mismo palo** es raro (5%).
- **En Short sale par mucho más seguido**: 24% contra 17%. Hay menos rangos (9
  en vez de 13), así que repiten más.
- **En Short hay escalera posible el doble de seguido**: en 36% de los flops sin
  par los 3 rangos entran en una escalera, contra 18% en Long.

### Estudio 3: bloqueadores (exacto, lecciones 21, 24 y 89–91)

`npx tsx scripts/lab/blockers.ts` (instantáneo). River, 1 rival. Color: hay 3
cartas de un palo en la mesa. Trío: hay un K en la mesa, sin par.

River, 1 rival. «Sin» = no tenés ninguna carta clave; «Con» = tenés una.

| Juego | Mazo | Color: sin → con 1 del palo | Baja | Color con As: sin → con el As | Trío de K: sin → con 1 K | Baja |
|---|---|---|---|---|---|---|
| Hold'em | Long | 4.5% → 3.6% | 20.0% | 0.9% → 0% | 0.3% → 0.1% | 66.7% |
| Omaha | Long | 22.6% → 18.8% | 17.0% | 4.9% → 0% | 1.9% → 0.7% | 65.5% |
| Manhattan | Long | 34.1% → 28.8% | 15.4% | 7.7% → 0% | 3.3% → 1.2% | 64.9% |
| Hold'em | Short | 3.7% → 2.5% | 33.3% | 1.2% → 0% | 0.7% → 0.2% | 66.7% |
| Omaha | Short | 20.4% → 14.4% | 29.3% | 7.2% → 0% | 4.9% → 1.7% | 64.8% |
| Manhattan | Short | 32.2% → 23.6% | 26.9% | 11.9% → 0% | 8.5% → 3.1% | 63.6% |

Cómo leerlo:

- **En Omaha y Manhattan el rival tiene la mano mucho más seguido**: con 3 del
  mismo palo en la mesa, en Hold'em tiene color el 4% de las veces; en Omaha el
  20–23% y en Manhattan el 32–34%.
- **Tener el As del palo pesa más en nuestros juegos**: le sacás el color máximo
  al rival, que en Manhattan Short lo tendría el 12% de las veces (en Hold'em,
  1%).
- **En proporción, una carta del palo bloquea menos cuando el rival tiene más
  cartas** (Long: 20% en Hold'em, 15% en Manhattan), pero lo que bloquea es mucho
  más en números absolutos.
- **En Short una carta bloquea más** (hay 9 por palo en vez de 13): 27–33% contra
  15–20%.
- Tener uno de los K le baja el trío al rival a un tercio (−65%) en los tres
  juegos.

### Estudio 4: manos con varios jugadores

Resultados: pendientes (corrida en curso).

## Próximos pasos propuestos

Hechos el 25/11: ejercicio "¿Qué le queda?" y estudios 2, 3 y 4.

Ideas para seguir:

1. Llevar los estudios 2 y 3 a la app: un ejercicio de bloqueadores ("¿qué
   chance hay de que tenga color?") con los números exactos de cada juego.
2. Estudio 5: qué tan seguido el que va adelante en el flop sigue adelante en el
   river, según la textura y el juego (lecciones 35, 39, 61).
3. Estudio 6: forma de la distribución de equity (pareja o polarizada) por juego
   (lecciones 15, 153–181).
