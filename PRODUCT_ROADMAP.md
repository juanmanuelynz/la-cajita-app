# Product roadmap — La Cajita Poker

Mejoras de producto pendientes, en orden de ROI / esfuerzo. Cada bloque es independiente: podés pedir cualquiera por separado en otro chat con un "sigamos con el item N del roadmap".

Estado al momento de escribir esto: ya están hechos el split de `page.tsx` en tabs + `lib/stats.ts`, `tie_break` persistido, validación Zod, `createMatch` atómico, y auth con PIN compartido (ver últimos commits del `main`).

---

## 1. Auto-completar el último jugador

**Problema actual**
En [app/partidas/[id]/page.tsx](app/partidas/[id]/page.tsx) el formulario obliga a balancear manualmente: si 7 jugadores tienen sus fichas finales cargadas, el 8º se deduce, pero hoy hay que tipearlo. `validateBalance` solo bloquea registrar si no cuadra.

**Cambio propuesto**
- Botón **"Auto-completar último"** que rellena el `finalChips` del jugador sin valor a partir de la diferencia (`totalInvestment - sum(otrosFinalChips)`).
- O mejor: indicador en vivo "Faltan/sobran $X fichas" que se actualice mientras tipeás, en vez de validar solo al registrar.
- Si el cálculo da negativo, warning explícito.

**Archivos**: [app/partidas/[id]/page.tsx](app/partidas/[id]/page.tsx)
**Esfuerzo**: 1–2h

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

## 3. Ceremonia de cierre de torneo (Podio Final)

**Problema actual**
`closeTournament()` solo setea `closed_at`. No hay vista de cierre, ni snapshot, ni export. Cuando cerrás un torneo se apaga sin más.

**Cambio propuesto**
Modal de cierre que muestre:
- **Podio**: 1°, 2°, 3° con puntos + plata + emoji/foto
- **Stats del torneo**: total de partidas, plata total movida, jugador más activo, mejor partida individual
- **Botón "Compartir"**: genera una imagen PNG (`html-to-image`) lista para WhatsApp, o un texto formateado con los resultados.
- **Botón "Export CSV"**: descarga toda la data del torneo (matches + match_players) para Excel.

Persistir un `closed_snapshot JSONB` en `tournaments` con el resumen para no recalcular si se abre años después.

**Archivos**: nuevo `components/tournament-closing-podium.tsx`, [components/tabs/reglas-tab.tsx](components/tabs/reglas-tab.tsx), [lib/database.ts](lib/database.ts), nueva dep `html-to-image`
**Esfuerzo**: 4–6h

---

## 4. Métricas más jugosas

**Problema actual**
La tab Estadísticas ya tiene mucho (ROI, comebacks, top wins/losses, evolución, eficiencia) pero falta lo más interesante para un grupo recurrente: relaciones entre jugadores y momentos.

**Cambios propuestos** (priorizar los que más enganchen):

### 4a. Racha actual + mejor racha histórica
- "Pedro lleva **3 partidas ganadas** en fila" (partidas con `money_won > 0`).
- Card destacada en cada perfil.

### 4b. Némesis / Bestia negra
- Para cada jugador A, calcular contra qué jugador B perdió más plata acumulada en partidas donde ambos jugaron.
- "El **némesis** de Pedro es Juan (-$25.000 en 8 partidas juntos)"

### 4c. Día de la semana favorito
- Agrupar partidas por `EXTRACT(DOW FROM date)` y mostrar qué día gana más cada jugador.

### 4d. ROI por sesión (no acumulado)
- El ROI actual es lifetime. Sumar uno por partida individual y mostrar la curva.

### 4e. "Killer move" — la partida con la mayor remontada relativa
- No solo plata absoluta. "Invirtió 4 cajitas, terminó +$48.000 → ROI 600%"

**Archivos**: [lib/stats.ts](lib/stats.ts), [components/tabs/estadisticas-tab.tsx](components/tabs/estadisticas-tab.tsx)
**Esfuerzo**: 1–2h por métrica

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

## 7. Mobile-first: bottom nav nativo y swipe entre tabs

**Problema actual**
La bottom nav actual ([app/page.tsx](app/page.tsx)) es funcional pero podría sentirse más "app". Las tabs no soportan swipe.

**Cambio propuesto**
- Swipe izquierda/derecha para cambiar de tab (con `embla-carousel-react`, ya instalado).
- `vaul` (también instalado) para los diálogos en mobile (bottom-sheet en vez de dialog centrado).
- Transición entre tabs con `framer-motion` (nueva dep) si querés animar.

**Archivos**: [app/page.tsx](app/page.tsx)
**Esfuerzo**: 3h
**Prioridad**: cosmética, alto retorno percibido

---

## 8. Default sort del ranking: decidir la "fuente de verdad"

**Problema actual**
Ranking ordena por `money` por default ([components/tabs/ranking-tab.tsx](components/tabs/ranking-tab.tsx)). Pero el sistema de puntos es la base del torneo según las Reglas. Los usuarios se pueden confundir.

**Cambio propuesto**
- Decisión de producto: ¿qué métrica define al ganador del torneo? Plata o puntos.
- Cambiar el default acorde.
- O hacerlo configurable por torneo (junto con `points_config` del item 2).

**Esfuerzo**: 15min de código + decisión

---

## Orden recomendado

| # | Item | ROI | Esfuerzo |
|---|------|-----|----------|
| 1 | Auto-completar último jugador | Alto | Bajo |
| 8 | Decidir default sort | Alto | Trivial |
| 4 | Métricas (rachas, némesis) | Alto | Medio |
| 3 | Podio final + export | Medio-Alto | Alto |
| 2 | `points_config` por torneo | Medio | Medio |
| 5 | Distinguir recompras | Medio | Alto |
| 7 | Swipe tabs / bottom sheets | Bajo | Medio |
| 6 | Lock concurrencia | Bajo | Alto |
