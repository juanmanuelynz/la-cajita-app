-- Partidas amistosas (one-time): se juegan y se anotan con la app, pero no
-- suman al torneo. Quedan colgadas del torneo en curso solo para aparecer en
-- su Historial; el ranking, las estadísticas y el histórico las ignoran.

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS is_casual BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE active_matches
  ADD COLUMN IF NOT EXISTS is_casual BOOLEAN NOT NULL DEFAULT false;

-- Verificar
SELECT
  (SELECT COUNT(*) FROM matches WHERE is_casual) AS casual_matches,
  (SELECT COUNT(*) FROM active_matches WHERE is_casual) AS casual_active_matches;
