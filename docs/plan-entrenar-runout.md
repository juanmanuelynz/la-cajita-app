# Plan: traer a Entrenar ideas de Runout Poker

Plan para retomar en otra sesión ("sigamos con el plan de Runout, fase N").
Escrito el 24/11/2026. Lo de Entrenar hecho hasta acá ya está en `main`.

## Contexto

- Runout Poker es una app de entrenamiento de Hold'em (iOS/Android, paga) con una
  estética minimalista que nos gusta. La idea es **adaptar funciones y criterios
  visuales**, no copiarla: nada de su nombre, logo, textos ni arte. Nuestra paleta
  sigue siendo la de la app (verde primario, grises zinc, dorado para lo lúdico,
  verde/rojo solo para bien/mal; cartas negro y coral).
- Ya hecho en Entrenar (ver commits de noviembre 2026): GTO en el river, tarjeta de
  jugador con nivel/racha/meta diaria, Desafío del día destacado, tira de
  ejercicios, mesa ovalada minimalista (`components/training/table-view.tsx`),
  cartas de 2 colores, pestañas con ícono, sin swipe entre pantallas.
- Ojo: `PRODUCT_ROADMAP.md` item 7 habla de "swipe entre tabs con embla": ya no
  existe (se sacó el 23/11 porque chocaba con lo que se desliza adentro).

## Lo que sabemos de Runout (investigado el 23/11)

Fuente: buscador web el 23/11; el 24/11 se habilitaron sus hosts en el entorno y
se leyó la web y Play Store (ver "Lo visual"). Casi todo es marketing del propio
desarrollador.

| Función | Qué hace | Nosotros |
|---|---|---|
| Sesión diaria personalizada | Sesión del día según tu nivel y errores | Desafío del día (igual para todos) |
| Preflop trainer | Rangos de apertura, call y 3-bet por posición | Solo apertura |
| Postflop | Tamaño de apuesta, frecuencia de bluff, control del pozo | GTO river, ¿Call o fold? |
| Configurar escenario | Cash 6-max / MTT / HU, stacks 20–100+ BB | Juego y mazo |
| 12 niveles de habilidad | Dificultad adaptativa | Niveles sin efecto en la dificultad |
| Leaks | Detecta errores repetidos y arma drills para corregirlos | No |
| Estadísticas | Aciertos por posición y por calle, historial y tendencias | Por ejercicio y por juego |
| Feedback | Acción → corrección inmediata con explicación | Sí |
| Offline | Funciona sin conexión | Ejercicios sí; guardar progreso necesita señal |

No encontramos rachas ni ranking entre amigos (eso lo tenemos nosotros).

Fuentes: [Play Store](https://play.google.com/store/apps/details?id=com.gramercy.runout), [App Store, hoy no carga](https://apps.apple.com/us/app/runout-poker-trainer-gto-coach/id6760210288),
[runoutpoker.com](https://runoutpoker.com/), [About](https://runoutpoker.com/about),
[GTO trainer](https://runoutpoker.com/train/gto-poker-trainer),
[AI training](https://runoutpoker.com/train/ai-poker-training),
[comparación](https://runoutpoker.com/compare/runout-poker-vs-poker-trainer).

### Lo visual (fase 0, hecha el 24/11/2026)

Fuentes: 11 imágenes de la web (`runoutpoker.com/assets/screen-*.png`) y las 7
capturas de Play Store (`com.gramercy.runout`). La ficha de App Store del link de
abajo hoy da "page not found". Las capturas **no** se suben al repo (son de ellos
y el repo es público); se describen acá. Para volver a bajarlas, el entorno ya
tiene habilitados `runoutpoker.com`, `play.google.com` y `play-lh.googleusercontent.com`.

**Estética general**
- Fondo negro puro; acento azul/índigo con resplandor (glow) detrás de la mesa y
  de las tarjetas destacadas. Tipografía sans muy limpia, números grandes y finos.
- Tarjetas: esquinas muy redondeadas, borde gris de 1 px, relleno apenas más
  claro que el fondo. Mucho aire, pocos colores.
- Verde = bien / acción elegida; rojo = mal o "raise" en los rangos; gris = fold.
- Botón principal blanco a todo el ancho, abajo ("Continue", "Got it").
- Nosotros: misma sobriedad, pero con nuestra paleta (verde primario en vez de
  índigo, zinc, dorado para lo lúdico).

**Mesa**
- Óvalo vertical con doble borde (anillo exterior oscuro + línea interior que
  brilla). Paño azul oscuro.
- Cada asiento: cartas boca abajo (rayadas) + cartelito en 2 partes
  `[POS | 100 BB]`. Los que ya foldearon quedan atenuados. El tuyo tiene la
  posición resaltada en verde y tus cartas (chicas, superpuestas) arriba del cartel.
- Etiqueta de acción bajo el cartel (pastilla azul "3-bet"), apuesta como ficha
  + número sobre el paño ("45"), botón de dealer amarillo "D".
- Pozo en cartelito `[Pot: | $22]` arriba del board; board en cartas blancas
  grandes (rojo para ♥♦).
- Encabezado gris arriba: formato y ciegas ("6-Max Cash Game • $1/$2").
- Debajo de la mesa, la situación en 1–2 frases ("You raise to $15 from the
  Lojack… the Button 3-bets to $45. What's your play?") y en chiquito los stacks.

**Pantalla de ejercicio**
- Arriba: ✕ / ‹ para salir, barra de progreso de la sesión, temporizador (0:30) o
  ícono para reportar la pregunta.
- Botones de acción en grilla de 2–3 columnas, oscuros con borde; varios tamaños
  ("4-bet to $90", "4-bet to $120").
- Variante sin mesa: historia de la mano en texto por calle ("Flop ($5.50) K♣ J♣ 8♠
  — BB checks…") y respuestas que son **manos** (4 botones con 2 cartas cada uno):
  "¿Cuál es mejor bluff en el river?".

**Respuesta / feedback**
- Al responder, sobre cada botón aparece la **frecuencia** correcta (5% / 80% / 15%).
  El elegido se enciende con borde y glow (verde si acertó); fold queda apagado.
- Hoja que sube desde abajo (bottom sheet con manija) tapando media mesa:
  ✓ verde en cuadradito + "That's right!", explicación en 1–2 párrafos, los botones
  con sus % y "Continue".
- En preflop, la hoja muestra la **grilla 13×13 del rango** con colores por acción
  (celdas partidas cuando es mixto), tu mano resaltada, y abajo barras por acción
  ("Raise 5% · Call 15% · Fold 80%").
- En la web también muestran "+12 EV points" / "-8 EV points" por decisión.

**Progreso y estadísticas**
- Inicio: "Poker rating 1,246" grande, "+32 last session" en verde, racha con 🔥
  en pastilla roja; botón "Recalibrate Trainer".
- "Your core statistics": tarjetas 2×2 con ícono + sigla (H-SCN, H-SEL, THEORY,
  PMATH), número grande "/ 100" y **barra de 5 segmentos** con degradé azul→turquesa.
  Sin datos: guion largo "— / 100" y segmentos vacíos.
- "Street performance": 4 **anillos** (Preflop / Flop / Turn / River) con el %.
  También por posición (In position / Out of position) y por tipo de pozo
  (SRP, 3-bet, 4-bet, limp).
- Pestañas tipo pastilla arriba (Total / Cash Game / Tournament).
- "Progress — Last 30 sessions": barras verticales por sesión con filtro 1W/1M/3M/1Y.
- Cada métrica tiene ⓘ que abre una hoja: valor actual grande con etiqueta
  ("33% Loose"), "What is this?", "How to improve", botón "Got it".

**Lo que dice la web (marketing)**
- "Adaptive drills… build sessions around your actual weak spots"; rehace el plan
  después de cada sesión. Leaks marcados automáticamente y seguidos en el tiempo.
- Aciertos por posición, por calle y por tipo de jugada; historial y tendencias.
- "Ranked training… skill tiers"; offline 100%; tiene web app además de las apps.

**Qué cambia en las fases por lo visto**
- Fase 1: el feedback como hoja desde abajo + botón "Seguir" a todo el ancho; los
  botones muestran el resultado encima (en lo nuestro que es exacto: equity o "✓"
  en vez de frecuencias mixtas, que no tenemos de fuente). El interruptor de
  "contexto" no aparece en estas capturas (era de su página de suscripción).
- Fase 2: cartelito `[lugar | cajitas]`, atenuar a los que se fueron, ficha +
  número para la apuesta, "D" para el que reparte, situación en texto bajo la mesa.
- Fase 3/5: tarjetas 2×2 con barra de 5 segmentos y anillos por calle son un buen
  molde para "Tus puntos débiles" y aciertos por calle; ⓘ con "Qué es / Cómo mejorar".
- Idea nueva posible: en "Antes del flop", mostrar en la respuesta la grilla 13×13
  del rango (ya tenemos los rangos de PokerStrategy) con tu mano marcada.
- Idea nueva posible: ejercicio de texto con respuestas que son manos ("¿con cuál
  bluffeás?"), sin mesa.

## Fases

Cada fase se puede hacer sola. Orden sugerido por impacto / esfuerzo.

### Fase 0 — Referencias visuales ✅ (24/11/2026)
- Hecha: ver "Lo visual" arriba. No encontramos capturas de la sesión diaria ni de
  la pantalla de leaks; sí de mesa, feedback, rangos y estadísticas.

### Fase 1 — Respuesta con más presencia
- Botones de acción (Fold / Check / Call / Bet / Raise y opciones) con borde de
  color y brillo al responder; misma pieza para todos los ejercicios.
- Feedback compacto ("¡Bien!" / "No era") y la explicación plegable ("Ver por qué").
- Interruptor "Contexto de la mano" para mostrar/ocultar pistas (nombre de la
  jugada del rival, pozo, etc.) → modo más difícil sin pistas.
- Archivos: `components/training/drill-shell.tsx` y cada `*-drill.tsx`.

### Fase 2 — Mesa con contexto
- En `PokerTable`: botón de dealer, lugar de cada jugador ("3º", "Reparte"),
  etiqueta de acción ("Apuesta", "Check"), apuesta como fichas sobre el paño y pozo.
- Unificar el diagrama de lugares de "Antes del flop" (`LuzSeats`, `SeatsRow` en
  `luz-drill.tsx` / `preflop.tsx`) con la mesa: los asientos alrededor del óvalo.
- Ojo con el ancho (iPhone SE, 320 px) y con Manhattan (5 cartas).

### Fase 3 — Tus puntos débiles
- Función pura en `lib/poker/training.ts` (con tests): a partir de
  `TrainingProgress` (`byDrill`, `byVariant`) ordena ejercicio×juego por tasa de
  error, con mínimo de respuestas para no sacar conclusiones con 2 datos.
- Tarjeta "Tus puntos débiles" (en el drawer de progreso y/o arriba de la tira) y
  botón "Practicar lo que más fallo": sesión de 10 preguntas sesgada a esos
  ejercicios (sin semilla de fecha; no reemplaza al Desafío del día).

### Fase 4 — Dificultad según el nivel
- Parámetro de dificultad en los generadores (`lib/poker/drills.ts`): p. ej. en
  ¿Call o fold? equity más cerca de lo necesario; en Outs más outs; en ¿Quién gana?
  manos más parejas. Tests con semilla.
- El Desafío del día NO cambia (tiene que ser igual para todos): dificultad fija.

### Fase 5 — Estadísticas por calle y lugar + tendencia
- Agregar columnas a `training_answers` (p. ej. `street`, `seat`), migración
  idempotente en `scripts/migrate.mjs` + `.sql` numerado de referencia.
- En el drawer de progreso: aciertos por calle / lugar y evolución por semana.

### Fase 6 — Más preflop (solo con fuente)
- Rangos de call / 3-bet. **No inventar**: buscar fuente publicada (como hicimos con
  PokerStrategy para apertura) y testear el conteo de combos. Si no hay fuente
  para Omaha/Manhattan, Beta etiquetada como ahora.

### Fuera de alcance por ahora
- Elegir stacks / formato (cash, torneo): en La Cajita se juega con luz y cajitas.
- Cola offline para respuestas (hoy es fire-and-forget; se pierde si no hay señal).

## Preguntas abiertas para el usuario

1. ¿La sesión personalizada (fase 3) reemplaza la tira de ejercicios como entrada
   principal o queda como un botón más?
2. ¿Botones de acción con brillo (fase 1) solo en Entrenar o en toda la app?
3. ¿Sumamos "stack" a la mesa usando cajitas, o no tiene sentido en la mesa de La Cajita?
