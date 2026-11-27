-- Truco: progreso de Practicar (una fila por respuesta), separado del Entrenar
-- de poker. Lo pueden grabar el admin y el invitado. Ver docs/plan-truco.md.

CREATE TABLE IF NOT EXISTS truco_answers (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id  UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  quiz       TEXT NOT NULL,
  correct    BOOLEAN NOT NULL,
  local_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS truco_answers_player_date ON truco_answers (player_id, local_date);
