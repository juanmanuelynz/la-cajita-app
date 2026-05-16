-- Configuración de distribución de puntos por torneo.
-- Permite que cada torneo decida su propia escala (top-pesado, plano, etc.)
-- en lugar de la constante hardcoded [10,7,5,3,2,1,0,0].

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS points_config JSONB NOT NULL
  DEFAULT '[10,7,5,3,2,1,0,0]'::jsonb;

-- Backfill explícito para torneos preexistentes (DEFAULT solo aplica a inserts).
UPDATE tournaments
SET points_config = '[10,7,5,3,2,1,0,0]'::jsonb
WHERE points_config IS NULL;

-- Verificar
SELECT id, name, points_config FROM tournaments;
