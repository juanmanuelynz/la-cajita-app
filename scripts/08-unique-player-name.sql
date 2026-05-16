-- Garantizar que cada jugador tenga un nombre único.
-- Sin esta restricción, dos partidas paralelas podían crear duplicados
-- (mismo nombre, distinto id) y las stats se rompían silenciosamente.

-- Normalizar espacios sobrantes antes de imponer el UNIQUE.
UPDATE players SET name = trim(name) WHERE name <> trim(name);

-- Si llegan a aparecer duplicados case-insensitive en el futuro, este script
-- falla en el CREATE UNIQUE INDEX — esa es la señal para resolver el merge
-- manualmente antes de re-correrlo.
CREATE UNIQUE INDEX IF NOT EXISTS players_name_unique ON players (name);
