# Product roadmap — La Cajita Poker

Mejoras de producto pendientes, en orden de ROI / esfuerzo. Cada bloque es independiente: podés pedir cualquiera por separado en otro chat con un "sigamos con el item N del roadmap".

Estado al momento de escribir esto: ya están hechos el split de `page.tsx` en tabs + `lib/stats.ts`, `tie_break` persistido, validación Zod, `createMatch` atómico, y auth con PIN compartido (ver últimos commits del `main`).

**Hecho desde la primera versión del roadmap**: items 1 (auto-completar + balance live), 3 (podio visual dual al cerrar torneo, parcial), 4 (rachas, némesis, día favorito, killer move y ROI por partida), 7 (swipe entre tabs con embla, parcial) y 8 (plata como fuente de verdad del ranking).

---

## 1. Auto-completar el último jugador ✅ HECHO

Implementado en commit `58774fd`. La card de balance ahora muestra "Faltan $X / Sobran $X" en vivo (ámbar/rosa según signo) y aparece un botón "Auto-completar &lt;jugador&gt;" cuando exactamente 1 jugador tiene fichas en 0 y el diff es positivo.

---

## 2. `points_config` por torneo

**Problema actual**
`POINTS_DISTRIBUTION = [10, 7, 5, 3, 2, 1, 0, 0]` está hardcoded en [lib/constants.ts](lib/constants.ts) y referenciado desde [lib/database.ts](lib/database.ts) y la tab de Reglas. Si querés un torneo con otra estructura (top 3 más pesado, solo 6 jugadores típicos), hay que tocar código.

**Cambio propuesto**
- Migration: `ALTER TABLE tournaments ADD COLUMN points_config JSONB NOT NULL DEFAULT '[10,7,5,3,2,1,0,0]'::jsonb`
- En `createTournament`, permitir pasar la config (con default).
- En `createMatch`, leer la config del torneo al que pertenece la partida antes de calcular puntos.
- UI en el diálogo "Crear Torneo" para editar la distribución (8 inputs numéricos, o presets: "Clásico", "Top-pesado", "Plano").
- Mostrar la config activa en Reglas en lugar del array hardcoded.

**Archivos**: nueva migration `09-points-config.sql`, [lib/database.ts](lib/database.ts), [lib/types.ts](lib/types.ts), [lib/validators.ts](lib/validators.ts), [components/tabs/reglas-tab.tsx](components/tabs/reglas-tab.tsx)
**Esfuerzo**: 3–4h

---

## 3. Ceremonia de cierre de torneo (Podio Final) ✅ PARCIAL

Implementado el podio visual: modal con **dos podios** (uno por plata, otro por puntos) + resumen del torneo (partidas, plata movida, jugador más activo, mejor partida individual). Se abre automáticamente al cerrar un torneo, y los torneos cerrados muestran un botón "Ver Podio" en Reglas.

**Pendiente del item original** (excluido por scope; pedir si lo necesitamos):
- Botón "Compartir" como texto/PNG (con `html-to-image`).
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

## 5. Recompras: distinguir buy-in inicial vs recompra

**Problema actual**
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

## 7. Mobile-first: bottom nav nativo y swipe entre tabs ✅ PARCIAL

Swipe entre tabs implementado en commit `e61834f` con `embla-carousel-react`. Sincronización bidireccional entre el carousel y la bottom nav (tap → scrollTo, swipe → setActiveTab). `touch-pan-y` permite que el scroll vertical de cada tab siga funcionando.

**Pendiente del item original**:
- Migración a `vaul` (bottom-sheets en lugar de Dialog centrado en mobile) — toca cada diálogo del proyecto, mejor como item aparte.
- Transición con `framer-motion` — opcional, embla ya da una animación fluida.

---

## 8. Default sort del ranking: decidir la "fuente de verdad" ✅ HECHO

Decisión tomada: **plata es la fuente de verdad** del ranking anual, puntos pasa a métrica secundaria. El default sort ya era `money`; lo que faltaba era alinear el texto de Reglas, que decía lo opuesto ("en caso de empate en puntos del ranking anual, gana quien tenga más dinero"). Ahora dice: el ranking se ordena por dinero ganado neto acumulado, y los puntos sirven como desempate.

Si en el futuro se hace configurable por torneo, queda atado al item 2 (`points_config`).

---

## Orden recomendado

| # | Item | ROI | Esfuerzo | Estado |
|---|------|-----|----------|--------|
| 1 | Auto-completar último jugador | Alto | Bajo | ✅ |
| 8 | Decidir default sort | Alto | Trivial | ✅ |
| 4 | Métricas (rachas, némesis, día favorito, killer move, ROI por partida) | Alto | Medio | ✅ |
| 3 | Podio final + export | Medio-Alto | Alto | ✅ parcial (falta share/CSV/snapshot) |
| 2 | `points_config` por torneo | Medio | Medio | pendiente |
| 5 | Distinguir recompras | Medio | Alto | pendiente |
| 7 | Swipe tabs / bottom sheets | Bajo | Medio | ✅ parcial (falta vaul) |
| 6 | Lock concurrencia | Bajo | Alto | pendiente |
