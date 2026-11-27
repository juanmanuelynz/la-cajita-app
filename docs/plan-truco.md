# Plan: Truco dentro de La Cajita

Una app hermana de truco argentino en **`/truco`**, adentro de La Cajita, con su
mismo look. Parte del artefacto "Truco argentino" (26/11/2026): motor de reglas
mano a mano sin flor, la máquina, lecciones, ejercicios y anotador. Acordado el
27/11/2026. **Hecho:** paso 1 (motor + máquina + tests). Lo demás está por
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

Pestañas con `IconTabsList` (mismo estilo que el resto):

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
- **Cartas españolas** como componente React nuevo
  (`components/truco/spanish-card.tsx`), con el mismo marco y sombra que
  `PlayingCard` de Entrenar y el **dorso de La Cajita** (`CardBack`, paño verde
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

- `app/truco/page.tsx` — pantalla (client component), pestañas.
- `lib/truco/engine.ts` — reglas (port del módulo `engine` del artefacto, a
  TypeScript, puro y con RNG sembrable).
- `lib/truco/ai.ts` — la máquina (`winChance`, `decide`).
- `lib/truco/quizzes.ts` — generadores de ejercicios (puros, sembrables).
- `lib/truco/lessons.tsx` — contenido de las lecciones.
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
