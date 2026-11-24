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

Fuente: buscador web; sus páginas no se pudieron abrir desde la sesión (la red
del entorno bloquea `runoutpoker.com` y `apps.apple.com`). Casi todo es marketing
del propio desarrollador.

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

Fuentes: [App Store](https://apps.apple.com/us/app/runout-poker-trainer-gto-coach/id6760210288),
[runoutpoker.com](https://runoutpoker.com/), [About](https://runoutpoker.com/about),
[GTO trainer](https://runoutpoker.com/train/gto-poker-trainer),
[AI training](https://runoutpoker.com/train/ai-poker-training),
[comparación](https://runoutpoker.com/compare/runout-poker-vs-poker-trainer).

### Lo visual (de 3 capturas de su página de suscripción)

- Mesa: óvalo vertical que ocupa el ancho, paño casi negro con tinte de color y
  una línea de borde fina que brilla apenas (doble línea).
- Jugadores sobre el borde con cartelito: posición + stack ("CO · 40 BB") y una
  etiqueta de la acción que hicieron ("Open", "3-bet", "Raise 2.5").
- Fichas apostadas sobre el paño, botón de dealer, pozo arriba del board ("Pot: 8.5").
- Tus cartas abajo, chicas, montadas sobre el borde.
- Botón "Show hand context" (mostrar/ocultar el contexto de la mano).
- Acciones: botones grandes con borde de color y brillo (Check verde, Bet rojo,
  varios tamaños "Bet 4bb / 9bb / 17bb"), se encienden al responder.
- Feedback corto ("Not quite!" con ✕ rojo) y la explicación en texto debajo.

## Fases

Cada fase se puede hacer sola. Orden sugerido por impacto / esfuerzo.

### Fase 0 — Referencias visuales (primero, después del clear)
- Juntar capturas de la app (App Store, Play Store, videos, redes). La red de la
  sesión bloquea esos sitios: o se habilitan los hosts en el entorno, o se pasan
  las capturas por el chat.
- Anotar: mesa, cartelitos, botones de acción, pantalla de feedback, progreso,
  sesión diaria, leaks. Actualizar este documento con lo que se vea.

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
