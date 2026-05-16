-- Persistir el tie-break en match_players para que las posiciones sean reproducibles.
-- Antes de este script, el tie-break se generaba con Math.random() en cada inserción
-- y nunca se guardaba en la tabla final → re-correr el fixer cambiaba posiciones.

ALTER TABLE match_players
  ADD COLUMN IF NOT EXISTS tie_break DOUBLE PRECISION;

-- Backfill: las filas históricas no tienen tie_break. Les asignamos uno aleatorio
-- pero estable (queda fijo en la fila desde acá en adelante).
UPDATE match_players
SET tie_break = random()
WHERE tie_break IS NULL;

ALTER TABLE match_players
  ALTER COLUMN tie_break SET NOT NULL;

ALTER TABLE match_players
  ALTER COLUMN tie_break SET DEFAULT random();
