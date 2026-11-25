# Plan: mesa online

Plan de la **etapa 1** de la mesa online: jugar entre el grupo, cada uno desde
su celular, en la misma mano y al mismo tiempo. Acordado el 25/11/2026.
**Todavía no hay código:** esto es lo que se va a construir.

## Decisiones

### Dónde está

- Pestaña nueva **Partidas → Online**, al lado de Partida, Historial y Sueltas.
  La ven el admin y los invitados.
- Cuando hay una mesa abierta: un puntito verde en la pestaña "Online" y un aviso
  arriba de "Partida" ("Hay una mesa online abierta (3/8) · Sentarme").

### Quién juega

- **Cualquiera puede crear una mesa**, con el PIN de admin o el de invitado.
- **Los invitados también pueden jugar.**
- **Hasta 8 lugares**, contando los bots.
- Cada uno se sienta como sí mismo gracias a su **PIN personal** (ver abajo).
  Así nadie puede sentarse como otro y ver sus cartas.
- Puede sentarse cualquier jugador, esté o no en la lista del torneo (como en
  una suelta).

### PIN personal

Además de los PIN de hoy, cada jugador tiene **su propio PIN de 6 dígitos**
para entrar a la app. Así la app sabe quién es:

- **Entrenar** elige su nombre solo (hoy se elige a mano una vez por celular).
- **En la mesa online** se sienta como él, sin pedir otro PIN.

Cómo funciona:

- **Los PIN de hoy siguen andando igual:** el del grupo sigue siendo admin y el
  de invitado sigue siendo invitado. Si entrás con uno de esos, la app no sabe
  quién sos: en Entrenar elegís el nombre a mano y, para sentarte en la mesa, te
  pide tu PIN personal. Nadie pierde el acceso el día del cambio.
- **Rol con PIN personal:** **solo Zeta es admin.** Todos los demás entran como
  **invitado**: sueltas, mesa online, Entrenar y Ajustes. Para manejar el torneo
  se sigue usando el PIN del grupo (o el PIN personal de Zeta).
- Quién es el admin no se escribe en el código (el repo es público): va en una
  variable de Vercel con el id del jugador (`ADMIN_PLAYER_ID`). El PIN de ese
  jugador solo se puede crear o cambiar desde una sesión de admin.
- **Cada uno arma el suyo:** la primera vez elige su nombre y crea su PIN. Una
  vez creado, solo el admin lo puede resetear (desde Configuración). Se guarda
  cifrado, nunca tal cual.
- Un PIN personal no puede ser igual al del grupo, al de invitado ni al de otro
  jugador.
- **Lo que queda abierto:** mientras alguien no armó su PIN, otro podría
  armárselo y sentarse en la mesa con su nombre. Entre amigos alcanza con que
  cada uno arme el suyo pronto; si pasa, el admin lo resetea.

### Reglas de juego

- **Luz** de $100 por jugador, sin ciegas. Habla primero el de la izquierda del
  que reparte y el que reparte habla último. Si nadie apostó, se puede pasar.
  Es la misma regla que el ejercicio "Con luz" de Entrenar.
- **Sin límite.** La subida mínima es igual a la última subida.
- **All-in con pozos laterales.**
- **Juegos:** Hold'em, Omaha, Manhattan y Short deck, con las reglas de la casa
  que ya están en el evaluador de Entrenar (`lib/poker/evaluator.ts`).
  Manhattan se juega como Omaha (flop, turn y river), con 5 cartas propias de
  las que se usan 2 o 3.
- **Quién elige el juego:** al crear la mesa se elige uno de tres modos:
  - **fijo** toda la noche, con juego y mazo elegidos al crearla;
  - **se rota**, una ronda de cada juego;
  - **elige el que reparte** en cada mano.
- **Tiempo para hablar:** 45 segundos. Si no contestás, pasás si se puede y,
  si no, te retirás. El reloj lo lleva el servidor, para que no dependa del
  celular del que tarda.

### Cajitas

- **El valor de la cajita se elige al crear la mesa** y arranca en $2.000.
- Cada cajita suma su valor en fichas.
- Se puede **pedir otra cuando te quedan $500 o menos**. Entra antes de la mano
  siguiente.

> **A confirmar** (propuesta, el grupo todavía no lo decidió):
> - ¿La luz también se elige al crear la mesa, arrancando en $100? Con
>   cajitas grandes, $100 queda chico.
> - ¿El límite para pedir otra cajita es siempre $500, o una cuarta parte de la
>   cajita? Con cajitas de $2.000 da lo mismo.

### Resultados

- **Sin bots:** al cerrar la mesa se anota sola como **suelta**, con las
  cajitas pedidas y las fichas finales de cada uno. Igual que las sueltas,
  **queda fuera del torneo**: sin torneo, 0 puntos y fuera del ranking, de las
  estadísticas y del histórico. Se puede jugar aunque no haya un torneo abierto.
- En la lista de Sueltas lleva una etiqueta **"Online"**.
- **Con bots, la partida no se anota.** Se descartó repartir lo que gana o
  pierde un bot porque se presta a discusiones.

### Bots

- Sirven para completar la mesa cuando son pocos.
- **Hold'em Long:** antes del flop siguen los rangos de PokerStrategy que ya usa
  Entrenar (`lib/poker/preflop.ts`, `preflop-vs.ts`).
- **Después del flop, y en Omaha, Manhattan y Short:** comparan la equity de su
  mano (`lib/poker/equity.ts`) con lo que tienen que pagar, con un poco de azar
  para no ser 100% previsibles. Fuera de Hold'em Long es una regla nuestra, sin
  fuente, así que llevan la etiqueta **Beta**.
- Son bots simples: juegan razonable pero el grupo los va a leer rápido. Un bot
  fuerte es otro proyecto.

## Cómo se construye

En este orden. Cada paso se puede probar por separado antes de seguir.

0. **PIN personal** (`lib/auth.ts`, `app/login/`, `lib/session.ts`): el token
   firmado pasa a llevar también el id del jugador; el login acepta los PIN de
   hoy y los personales; Entrenar toma el nombre de la sesión cuando lo hay.
   Va antes que la mesa porque la mesa lo necesita. Los tokens viejos tienen
   que seguir valiendo (como cuando se sumó el rol de invitado).
1. **Motor de la mano** (`lib/poker/table.ts`, nuevo, con tests). Código puro,
   sin base de datos ni pantalla: luz, orden de habla, el botón que rota,
   pasar, apostar, pagar, subir, retirarse, all-in, pozos laterales, reparto
   según el juego y quién gana. Tests con manos armadas a mano: pozos laterales
   con tres all-in distintos, pozos repartidos, subida mínima y Short deck.
2. **Base de datos** (`scripts/15-online-tables.sql` y `scripts/migrate.mjs`):
   - tabla `online_tables`: estado de la mesa en JSONB, el mazo (nunca sale del
     servidor) y un número de versión;
   - columna `pin_hash` en `players`.
3. **Acciones del servidor** (`lib/online-table.ts`, nuevo): crear mesa,
   sentarse con PIN, actuar, pedir cajita, cerrar y "ver la mesa".
   - "Ver la mesa" le devuelve a cada uno **solo sus cartas**. Las de los demás
     aparecen recién si se muestran al final.
   - Las cartas se mezclan con azar seguro del servidor (`crypto`), no con el
     azar de Entrenar.
   - Cada acción manda la versión de la mesa: si no coincide, se rechaza (un
     doble toque no cuenta dos veces).
   - Cada acción decide qué rol puede llamarla, como pide `CLAUDE.md`.
4. **Bots** (`lib/poker/bot.ts`, nuevo, con tests). Juegan en el servidor
   cuando les toca.
5. **Pantalla** (`components/online/`, nuevo): la mesa ovalada reutilizando
   `RingTable` y `PlayingCard` de Entrenar; pozo, fichas, quién habla, el reloj
   y los botones. El celular pregunta por cambios cada 1,5 segundos.
6. **Cierre y registro:** sin bots, crea la suelta con lo mismo que usa hoy
   "Registrar partida" (`registerActiveMatch`).

## Riesgos

- **Adivinar un PIN:** con 6 dígitos son un millón de combinaciones. El login
  ya tarda medio segundo por intento; igual conviene sumar un límite de
  intentos fallidos cuando se haga.
- **Costo de la base (Neon, plan gratis):** mientras se juega, la base no se
  duerme. Una noche de 4 horas gasta unas 4 de las ~100 horas de cómputo
  gratis por mes. Antes de empezar hay que ver cuánto usa la app hoy.
- **Demora:** preguntando cada 1,5 segundos, entre que alguien juega y los
  demás lo ven puede pasar hasta eso. Para poker alcanza. Si molesta, más
  adelante se puede pasar a WebSockets: Vercel los soporta desde 2026, pero la
  conexión se corta a los ~5 minutos y no está claro si ya salió de beta.
- **Desconexiones:** si a alguien se le corta, la mesa sigue y el reloj lo hace
  pasar o retirarse. Al volver a abrir la app retoma su asiento.

## Fuera de la etapa 1

- Modo **por turnos**, sin apuro, con aviso al celular cuando te toca. Usa el
  mismo motor; en iPhone las notificaciones andan en la app instalada desde
  iOS 16.4.
- Chat o reacciones.
- Estadísticas de las mesas online.
