# Plan: Truco dentro de La Cajita

Una app hermana de truco argentino en **`/truco`**, adentro de La Cajita, con su
mismo look. Parte del artefacto "Truco argentino" (26/11/2026): motor de reglas
mano a mano sin flor, la máquina, lecciones, ejercicios y anotador. Acordado el
27/11/2026. **Hecho:** paso 1 (motor + máquina + tests), paso 2 (ruta `/truco`
con las pestañas y los botones para ir y volver) y paso 3 (carta española y
Aprender). Lo demás está por
construir.

## Decisiones

### Cómo se entra y se sale

- En La Cajita, **Configuración (engranaje) → Ajustes** tiene un botón
  **"Quiero jugar Truco"** que lleva a `/truco`.
- En Truco, su propia **Configuración** tiene **"Quiero jugar Poker"** que
  vuelve a `/`.
- La app instalada **siempre abre en Poker** (`/`), aunque la última vez
  hayas estado en Truco.
- El encabezado de Truco dice **"La Cajita Truco"**.
- Es la misma PWA: un solo ícono instalado, el manifest y el service worker no
  cambian (el scope `/` ya cubre `/truco`).

### Quién entra

- **Admin e invitado** (las dos claves). El middleware ya deja pasar a
  cualquiera con sesión, así que no hace falta tocarlo. Todo lo de Truco corre
  en el celular salvo el progreso de Entrenar (abajo), que también puede
  grabar el invitado, igual que en el Entrenar de poker.

### Qué se guarda

- **Solo lo de Practicar** (los ejercicios) va a la base: una fila por
  respuesta, como `training_answers`.
- Tabla nueva **`truco_answers`**: id, player_id (→ players), quiz
  (`gana` | `envido` | `puntos`, validado con una lista única de ids),
  correct, local_date, created_at. Migración idempotente en
  `scripts/migrate.mjs` + archivo numerado `scripts/15-truco.sql`.
- Server Actions nuevas en `lib/database.ts`: `recordTrucoAnswer` (fire-and-
  forget, como `recordTrainingAnswer`) y `getTrucoProgress` (aciertos/total por
  ejercicio y racha). Las dos permitidas para admin e invitado.
- **Son dos apps separadas:** el entrenamiento de Truco tiene su propio nivel,
  su meta diaria y su progreso; no suma ni resta nada al Entrenar de poker
  (ni a `levelFor`, ni a `DAILY_GOAL`, ni a Nano).
- **El jugador es el mismo que elegiste en Entrenar** (misma clave
  `la-cajita:entrenar:jugador`): no se vuelve a preguntar. Si no elegiste,
  se pide una vez con el mismo selector.
- La partida contra la máquina, el récord y el anotador quedan en
  localStorage (como en el artefacto), con claves `la-cajita:truco:*`.

### Secciones de `/truco`

La misma barra flotante de abajo que Poker (`components/dock-nav.tsx`, la
comparten las dos), con **Anotar** como botón grande del centro, como
Partidas en Poker (decidido el 27/11/2026; antes decía `IconTabsList`
arriba). Orden: Aprender, Practicar, Anotar, Jugar, Ajustes. Los íconos dicen
qué hace cada pestaña, como en Poker: gorro de graduado (Aprender), cerebro
(Practicar, el mismo de Entrenar), fósforo propio al centro
(`components/truco/fosforo-icon.tsx`, como la pica en Poker), espadas
cruzadas (Jugar) y engranaje (Ajustes). Las pantallas quedan montadas
al cambiar de pestaña, para no perder una partida, y la última pestaña se
recuerda en `la-cajita:truco:tab`.

| Pestaña | Qué tiene | Origen |
|---|---|---|
| Aprender | Las 8 lecciones (baraja, mano, jerarquía, envido, truco, partida, flor, señas) | artefacto, texto tal cual |
| Practicar | ¿Qué carta gana?, ¿Cuántos tantos?, ¿Cuántos puntos son? — con progreso en la base | artefacto + DB |
| Jugar | Mano a mano contra la máquina, a 15 o 30, sin flor, con el registro "Qué pasó en esta mano" | artefacto |
| Anotar | Anotador con fósforos, malas/buenas, pantalla siempre prendida (ver abajo) | artefacto, cambiado |
| Configuración | Ajustes (tema, sonidos — el mismo `AjustesCard`) + "Quiero jugar Poker" + salir | nuevo |

Fuera de esta versión: flor, parejas 2 vs 2, jugar online.

### Anotador con fósforos

- Los puntos se anotan con **fósforos** dibujados (no palitos): de a 5, cuatro
  en cuadrado y el quinto cruzado en diagonal. A 30, las malas arriba y las
  buenas abajo, separadas por una línea.
- **Tocar** la columna de un equipo suma 1 fósforo.
- **Mantener apretado medio segundo** saca 1 fósforo (solo uno, nunca todo).
  Mientras se mantiene, el último fósforo se va apagando; si se suelta antes,
  no pasa nada. En Android vibra (`navigator.vibrate`); en iPhone no se puede.
- **Sin botones de +N / −N**: los puntos grandes (por ejemplo una falta
  envido) se suman tocando varias veces, como en la mesa de verdad.
- "Empezar de cero" queda a un costado, con confirmación (`AlertDialog`).
  "A 15 / A 30" y los nombres de los equipos se mantienen.

### Look and feel

- Se tira el CSS del artefacto (paño verde, papel crema) y se usan los tokens
  de La Cajita (`--background`, `--card`, `--primary`…), shadcn (`Card`,
  `Button`, `AlertDialog`) y modo oscuro por defecto.
- **Paleta propia, no la de Poker**: **Oro y espada** (oro de principal
  sobre el azul de la espada, en oscuro y en claro), elegida el 27/11/2026
  entre tres probadas en la app (las otras: Naipe, bermellón y crema; Boliche,
  oro y granate). Va como clase `.truco` en `<html>` mientras estás en
  `/truco` (`hooks/use-truco-theme.ts`, tokens en `app/globals.css`).
- El dorso (`CardBack`, `.card-back-felt`) toma sus colores de variables
  (`--back-from`, `--back-to`, `--back-glow`, `--back-leaf`): en Poker sigue
  el paño verde, en Truco el color de la paleta, siempre con la hojita.
- **Cartas españolas** como componente React nuevo
  (`components/truco/spanish-card.tsx`), con el mismo marco y sombra que
  `PlayingCard` de Entrenar y el **dorso de La Cajita** (`CardBack`, azul de la paleta
  con la hoja) en lugar del rayado rojo. Los palos (oro, copa, espada, basto)
  se redibujan en SVG a partir de los del artefacto.
- La mesa contra la máquina usa el mismo lenguaje que la Mesa de práctica
  (paño, cartelitos, botones de respuesta de `drill-shell`), no `RingTable`
  (son dos lugares fijos: arriba la máquina, abajo vos).
- Confirmaciones ("Abandonar partida", "Empezar de cero" en el anotador) con
  `AlertDialog`, como en la Mesa de práctica (reemplaza el "tocá de nuevo").
- "Atrás" del celular: `useBackToClose` para salir de una partida o una
  lección sin salir de la app.

### Sonidos y animaciones

Con lo que ya hay en `public/sounds` y `lib/sounds.ts` (respeta el mute de
Ajustes):

- Repartir: `cardShuffle` + `cardDeal` por carta, con la animación de
  repartir de `hole-cards.tsx`.
- Tirar una carta: `cardDeal` y la carta vuela del lugar a la baza.
- Cantar (truco, envido, quiero): globo con un "pop" y `latchClick`.
- Ganar la mano: `chipsStack`; ganar la partida: `jingleMatch` + la
  celebración compartida (`components/celebration.tsx`).
- Error (tocar algo que no se puede): `error`.

Si falta algún sonido propio del truco (por ejemplo una voz), se busca uno CC0
y se suma a `CREDITS.txt`; no se inventa nada sin preguntar.

## Archivos

- `app/truco/page.tsx` — pantalla (client component), pestañas; `app/truco/layout.tsx` — título "La Cajita Truco".
- `components/dock-nav.tsx` — la barra de abajo, compartida con Poker.
- `components/ajustes-card.tsx` — prop `app` ("poker" | "truco") para el botón "Quiero jugar Truco / Poker".
- `lib/truco/engine.ts` — reglas (port del módulo `engine` del artefacto, a
  TypeScript, puro y con RNG sembrable).
- `lib/truco/ai.ts` — la máquina (`winChance`, `decide`).
- `lib/truco/quizzes.ts` — generadores de ejercicios (puros, sembrables).
- `components/truco/lessons.tsx` — contenido de las lecciones (es JSX con cartas, por eso va en components); `components/truco/aprender.tsx` — menú de lecciones (con las leídas, en `la-cajita:truco:lecciones-leidas`) y cada lección en su pantalla con "Volver".
- `components/truco/spanish-card.tsx` — `SpanishCard` (xs a xl), `SpanishCardBack` y `SuitPip`; `components/truco/fosforos.tsx` — los fósforos (ícono, lección y anotador).
- `lib/truco/quiz-ids.ts` — lista única de ids de ejercicios (la usan el
  validador del servidor y la UI).
- `components/truco/` — carta española, mesa, anotador, fósforos, lecciones,
  ejercicios.
- `tests/truco.test.ts` — Vitest: jerarquía (14 escalones), tantos de envido
  (casos de las lecciones: 33, 25, 6), valores de envido querido/no querido
  (tabla de la lección), truco/retruco/vale cuatro, pardas (los tres casos de
  la lección), "el envido va primero", falta envido, y un fuzz de partidas
  máquina contra máquina que termina siempre y nunca pasa del objetivo.
- `docs/plan-truco.md` (este) y una línea en `CLAUDE.md`.

## Pasos

1. Motor + tests (sin UI). Revisar contra las reglas de las lecciones; lo que
   no esté claro se pregunta antes de decidir.
2. Ruta `/truco` con pestañas vacías + botones "Quiero jugar Truco / Poker".
3. Carta española y Aprender.
4. Anotar.
5. Jugar contra la máquina (mesa, sonidos, animaciones).
6. Practicar + tabla `truco_answers` + progreso.
7. Probar en el celular (screenshots a 390 px) y actualizar `CLAUDE.md`.

Cada paso se sube por separado para poder probarlo.

## Preguntas resueltas (27/11/2026)

- Al abrir, la app instalada va siempre a Poker.
- Truco y Poker son apps separadas: cada entrenamiento tiene sus niveles
  propios.
- Encabezado: "La Cajita Truco".

## Reglas del motor que no estaban en las lecciones (27/11/2026)

- **Después de una baza parda tira primero el mano** (el artefacto hacía
  tirar al que había empezado la parda). La lección "Cómo es una mano" tiene
  que decirlo cuando se haga Aprender (paso 3).
- **Si te cantan envido podés subirlo** (real / falta) aunque ya hayas tirado
  tu primera carta; lo que no podés es cantarlo vos primero (el artefacto solo
  dejaba querer o no querer).
- **Irse al mazo** da solo lo que vale la mano, sin puntos de envido (como el
  artefacto).
- Sin cambios respecto del artefacto: no se canta envido después de tirar tu
  primera carta ni con un truco ya querido; al truco (no al retruco) se le
  puede contestar con envido.

El estado de la partida es un objeto plano (como `lib/poker/table.ts`): cada
acción devuelve uno nuevo y el azar entra por un `rng` (en el artefacto el
`rnd` vivía dentro del estado y no se podía guardar).
