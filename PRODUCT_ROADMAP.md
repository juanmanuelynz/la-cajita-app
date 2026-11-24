# Product roadmap — La Cajita Poker

Mejoras de producto pendientes, en orden de ROI / esfuerzo. Cada bloque es independiente: podés pedir cualquiera por separado en otro chat con un "sigamos con el item N del roadmap".

Estado al momento de escribir esto: ya están hechos el split de `page.tsx` en tabs + `lib/stats.ts`, `tie_break` persistido, validación Zod, `createMatch` atómico, y auth con PIN compartido (ver últimos commits del `main`).

**Hecho desde la primera versión del roadmap**: items 1 (auto-completar + balance live), 2 (points_config por torneo), 3 (podio final animado y compartible, parcial), 4 (rachas, némesis, día favorito, killer move y ROI por partida), 7 (bottom nav con nombres y transición entre tabs, parcial; el swipe se sacó), 8 (plata como fuente de verdad del ranking), 9 (animaciones y resumen de partida) y 10 (ESLint).

**Descartado**: item 5 (recompras como columna nueva) — ver el item.

---

## 1. Auto-completar el último jugador ✅ HECHO

Implementado en commit `58774fd`. La card de balance ahora muestra "Faltan $X / Sobran $X" en vivo (ámbar/rosa según signo) y aparece un botón "Auto-completar &lt;jugador&gt;" cuando exactamente 1 jugador tiene fichas en 0 y el diff es positivo.

---

## 2. `points_config` por torneo ✅ HECHO

Implementado en commit `2633610`. Migration `09-points-config.sql` agrega `tournaments.points_config JSONB NOT NULL DEFAULT '[10,7,5,3,2,1,0,0]'::jsonb` y backfillea torneos preexistentes. `createTournament` acepta una distribución opcional validada con Zod (8 enteros ≥ 0, monótonos no crecientes); `createMatch` lee la config del torneo correspondiente antes de calcular puntos. El dialog "Crear Torneo" en Reglas trae presets ("Clásico", "Top-pesado", "Plano") + 8 inputs editables, y la tabla de Sistema de Puntos refleja la config del torneo seleccionado. La preview de cierre de la partida activa también usa la config del torneo asociado.

**No incluido** (pedir si lo necesitamos): editar la config de un torneo ya creado, o variar el largo del array (hoy siempre son 8 posiciones).

---

## 3. Ceremonia de cierre de torneo (Podio Final) ✅ PARCIAL

Pantalla completa ([components/tournament-closing-podium.tsx](components/tournament-closing-podium.tsx)): podio por plata revelado 3°→2°→1° con montos que cuentan, lluvia de fichas, campeón, podio por puntos, resumen del torneo (partidas, plata en juego, más activo, mejor noche) y resto del ranking. Se abre automáticamente al cerrar un torneo, y los torneos cerrados muestran un botón "Ver Podio" en Reglas.

**Compartir**: botón que genera una imagen 1080×1350 del ranking final (dibujada en canvas, sin `html-to-image`) y la manda con el menú nativo del celular; si el navegador no puede, la descarga.

**Pendiente del item original** (excluido por scope; pedir si lo necesitamos):
- Botón "Export CSV" para Excel.
- Persistencia del snapshot en `closed_snapshot JSONB` (hoy se recalcula desde `playerStats` + `matches` cada vez).

---

## 4. Métricas más jugosas ✅ HECHO

**En la card expandida de cada jugador (tab Estadísticas)**:
- **Racha actual**: ganadas o perdidas consecutivas (Flame/Skull).
- **Mejor racha**: cadena más larga de wins consecutivos.
- **Némesis**: oponente con el diferencial cabeza a cabeza más alto contra el jugador (suma de `B.money_won − A.money_won` en partidas compartidas, mínimo 3).
- **Día favorito**: día de la semana donde el jugador acumula más neto (mínimo 2 partidas en ese día).
- **Killer move**: partida con mejor ROI relativo (la más eficiente, no la de mayor pozo absoluto).

**Card global nuevo**:
- **ROI por partida**: chart de líneas con el ROI de cada partida individual a lo largo del tiempo (una serie por jugador).

**Limpieza asociada**:
- Removidas dos métricas redundantes: "Mayores Recuperaciones" (correlacionaba ~1:1 con "Mejores Partidas") y el bar chart "ROI por Cajita" (era la misma fórmula que el eje Y del scatter "Eficiencia vs Inversión", que ahora queda como la representación única del ROI/eficiencia con cuadrantes Genio/Apostador/Conservador/Temerario).
- Glosario completo en la tab Reglas.

---

## 5. Recompras: distinguir buy-in inicial vs recompra ❌ DESCARTADO

**Por qué se descarta**: en La Cajita todos arrancan siempre con 1 cajita, así que cada cajita extra es una recompra: `recompras = cajitas - 1`. El dato ya está en la base y no hace falta columna, migration ni contadores separados. Si se quieren métricas como la "tasa de recompra" (% de partidas con `cajitas > 1`), se calculan directo en [lib/stats.ts](lib/stats.ts).

Lo que sigue es la propuesta original, que solo tendría sentido si cambia la regla de buy-in.

**Problema actual (original)**
`cajitas` mezcla el buy-in inicial con las recompras. Alguien que entró tarde con 2 cajitas se contabiliza igual que alguien que recompró tras perder. Para "agresividad" / "tilt" sería oro saberlo.

**Cambio propuesto**
- Migration: agregar `rebuys INTEGER NOT NULL DEFAULT 0` a `match_players` (`cajitas` total = `1 + rebuys` por defecto, o input separado).
- UI en partida activa: dos contadores separados — "Buy-in" y "Recompras".
- Nueva métrica: **tasa de recompra** (% de partidas donde recompraste).
- "Recuperación post-recompra": cuánto recuperaste cuando recompraste vs cuando no.

**Archivos**: nueva migration, [lib/database.ts](lib/database.ts), [lib/types.ts](lib/types.ts), [app/partidas/[id]/page.tsx](app/partidas/[id]/page.tsx), [lib/stats.ts](lib/stats.ts)
**Esfuerzo**: 4–5h
**Riesgo**: para las filas históricas, el backfill es `rebuys = cajitas - 1`. Razonable si asumís que todos arrancan con 1 cajita.

---

## 6. Lock de edición concurrente

**Problema actual**
Si tres personas abren la app en la misma partida activa, todas pueden editar al mismo tiempo. El auto-save de 500ms hace que la última gana. Para una app de poker presencial **probablemente está bien**, pero no es explícito.

**Cambio propuesto** (opcional)
- Mostrar "X usuarios viendo esta partida" (presence ligera por cookie/ip).
- O un lock soft: el primero que tipea adquiere lock por 30s; los demás ven el form read-only con botón "Tomar control".
- Honestamente, **dejar esto para después** salvo incidente real.

**Esfuerzo**: 6–8h
**Prioridad**: baja

---

## 7. Mobile-first: bottom nav nativo y transición entre tabs ✅ PARCIAL

- El swipe entre tabs se hizo en el commit `e61834f` con `embla-carousel-react`, y **se sacó el 23/11/2026** (commit `fbca344`): chocaba con lo que se desliza de costado adentro de las pestañas (la tira de ejercicios de Entrenar, tablas). Ahora solo se cambia de pestaña con la barra de abajo. Embla sigue en `app/page.tsx` con `watchDrag: false`, solo para la animación al tocar la barra.
- Barra de abajo con ícono y nombre (Ranking, Partidas, Estadísticas, Entrenar, Ajustes) y la activa en color, desde el 24/11/2026. Las pestañas internas de cada pantalla (`IconTabsList`) van arriba, todas iguales.

**Pendiente del item original**:
- Migración a `vaul` (bottom-sheets en lugar de Dialog centrado en mobile) — toca cada diálogo del proyecto, mejor como item aparte.
- Transición con `framer-motion` — opcional, embla ya da una animación fluida.
- Volver a deslizar entre tabs: solo si se resuelve el choque con lo que se desliza adentro de las pestañas.

---

## 8. Default sort del ranking: decidir la "fuente de verdad" ✅ HECHO

Decisión tomada: **plata es la fuente de verdad** del ranking anual, puntos pasa a métrica secundaria. El default sort ya era `money`; lo que faltaba era alinear el texto de Reglas, que decía lo opuesto ("en caso de empate en puntos del ranking anual, gana quien tenga más dinero"). Ahora dice: el ranking se ordena por dinero ganado neto acumulado, y los puntos sirven como desempate.

Si en el futuro se hace configurable por torneo, queda atado al item 2 (`points_config`).

---

## 9. Animaciones y resumen de partida ✅ HECHO

Todo con CSS 3D / SVG / canvas, sin librerías de animación (la PWA sigue liviana). Respeta "reducir movimiento" del sistema.

- **Fin de la partida** ([components/match-summary.tsx](components/match-summary.tsx), lógica en [lib/match-summary.ts](lib/match-summary.ts) con tests): se abre al registrar una partida y desde el historial ("Ver resumen"). Podio 3°→2°→1°, lluvia de fichas, datos destacados (racha, primera victoria, récord, nuevo líder, escalada, compra de cajitas) y el ranking del torneo reordenándose. Botón para compartir imagen.
- **Piezas compartidas** de celebración en [components/celebration.tsx](components/celebration.tsx) (overlay, podio animado, compartir), usadas también por el cierre de torneo.
- **Fichas**: todos los spinners son una ficha que gira ([components/poker-chip.tsx](components/poker-chip.tsx)); en la partida en vivo cae una ficha al sumar cajitas y el pozo cuenta hacia arriba.
- **Nueva partida**: dos cartas boca abajo que se doblan para espiarlas como en hold'em, con una mano al azar en cada vuelta; al crear la partida se mezclan ([components/hole-cards.tsx](components/hole-cards.tsx)).
- **Login**: maletín de aluminio de fichas en 3D que se abre con el PIN correcto ([components/chip-case.tsx](components/chip-case.tsx)).

---

## 10. Lint ✅ HECHO

`npm run lint` corre ESLint 9 con la config de Next (`next/core-web-vitals` + `next/typescript`) en [eslint.config.mjs](eslint.config.mjs). `next lint` está deprecado, por eso se usa la CLI de ESLint. Se ignoran los archivos generados por shadcn. `next build` también corre el lint, así que un error de lint frena el deploy.

---

## 11. Pestaña Entrenar (aprender a jugar) — etapas 1 a 5 y plan Runout ✅ HECHOS

Inspirada en apps tipo "Runout Poker", pero solo con lo que se puede calcular exacto (sin tablas "GTO" inventadas). Juegos: Hold'em (2 cartas), Omaha (4, usa 2 + 3 de la mesa) y Manhattan (5, usa 2 o 3 de la mano + 3 o 2 de la mesa), cada uno con mazo Long o Short (36 cartas; color > full; A-6-7-8-9 es escalera; en La Cajita la escalera le gana al trío).

**Hecho**:
- Etapas 1–3: motor en `lib/poker/` (evaluador verificado contra las 2.598.960 manos de 5 cartas), ejercicios "¿Qué tenés?" (qué cartas podés usar, con la trampa típica de Omaha/Manhattan), "¿Quién gana?", "Contá los outs" y "¿Pagás?" (pot odds en pesos), calculadora de equity y tabla de jugadas.
- Etapa 4: progreso por jugador (elegís tu nombre una vez por celular; aciertos por ejercicio y por juego, días seguidos) y Desafío del día (10 preguntas iguales para todo el grupo, un intento por día, ranking). Tablas `training_answers` y `training_daily` (script 13).

- Etapa 5: ejercicio "¿Abrís?" y tabla "Qué manos abrir" (13×13) para Hold'em Long, con los rangos de apertura 6-max de PokerStrategy.com (lecciones "No-Limit 6-max Pre-flop Ranges", 12/03/2026). Con 4 o 5 jugadores se sacan las primeras posiciones (adaptación nuestra, no de la fuente).

- "¿Cuál es mejor?": dos manos antes del flop, mano a mano, para los 6 juegos (respuesta calculada, diferencia mínima de 8 puntos).
- Principios para elegir manos de Omaha en Jugadas (PokerStrategy.com, "PLO for Beginners (2) – Preflop Play").
- "¿Abrís?" Beta para Hold'em short, Omaha y Manhattan: inferido (equity contra 2 manos al azar + mismo % por posición que Hold'em). Validado contra la fuente en Hold'em largo: coincide en 85–94% pero falla en manos de borde. Datos en `lib/poker/preflop-beta-data.ts`, generados por `scripts/gen-preflop-beta.ts`.

- "Con luz", como se juega en La Cajita (luz igual para todos, sin ciegas, se puede pasar antes del flop, habla primero el de la izquierda del que reparte, apuestas libres): orden de la mesa, "nunca hacer fold si podés pasar" y ¿Pagás antes del flop? con el pozo de luces (respuesta calculada). Arriba hay un selector Luz | Ciegas (por defecto Luz): el ejercicio "Antes del flop" y la tabla de Jugadas se adaptan; con Ciegas se practica el juego de casino.

- Plan "Runout" (24/11/2026, fases 0–6, detalle en `docs/plan-entrenar-runout.md`): botones de respuesta con brillo y monto promedio, respuesta en panel desde abajo; mesa con todos los lugares, fichas y botón D; tus puntos débiles + "Practicar lo que más fallo"; dificultad automática según el nivel; aciertos por calle, por lugar y por semana (columnas `street` y `seat`, script 14); "Te suben / Te resuben" con los rangos de pagar y resubir de PokerStrategy (solo Hold'em Long, 6 jugadores).

**Pendiente**:
- Cuándo apostar o pasar con luz si nadie apostó: no hay fuente y no se puede validar una inferencia; se decidió no hacerlo por ahora.
- Más adelante: explicaciones con IA vía Claude API. El plan Max trae créditos mensuales de API (hay que vincular una organización de la Claude Console); la API key iría como env var en Vercel, nunca `NEXT_PUBLIC_`.

---

## Orden recomendado

### Pendientes

| # | Item | ROI | Esfuerzo | Estado |
|---|------|-----|----------|--------|
| 3 | Podio final: CSV/snapshot | Bajo | Medio | ✅ parcial |
| 7 | Bottom sheets con vaul | Bajo | Medio | ✅ parcial |
| 6 | Lock concurrencia | Bajo | Alto | pendiente |

### Hechos

| # | Item | Estado |
|---|------|--------|
| 1 | Auto-completar último jugador | ✅ |
| 2 | `points_config` por torneo | ✅ |
| 4 | Métricas (rachas, némesis, día favorito, killer move, ROI por partida) | ✅ |
| 8 | Decidir default sort | ✅ |
| 9 | Animaciones y resumen de partida | ✅ |
| 10 | Lint con ESLint | ✅ |

### Descartados

| # | Item | Motivo |
|---|------|--------|
| 5 | Distinguir recompras | Siempre se arranca con 1 cajita: recompras = cajitas − 1 |
