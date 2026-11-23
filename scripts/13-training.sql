-- Pestaña Entrenar: progreso por jugador y Desafío del día.
-- Cada respuesta de un ejercicio queda en training_answers (local_date es la
-- fecha del celular, para que "hoy" y las rachas no dependan del huso del
-- servidor). training_daily guarda un intento por jugador y por día.

CREATE TABLE IF NOT EXISTS training_answers (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id  UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  drill      TEXT NOT NULL,
  game       TEXT NOT NULL,
  deck       TEXT NOT NULL,
  correct    BOOLEAN NOT NULL,
  local_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS training_answers_player_date
  ON training_answers (player_id, local_date);

CREATE TABLE IF NOT EXISTS training_daily (
  player_id      UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  challenge_date DATE NOT NULL,
  score          INTEGER NOT NULL,
  total          INTEGER NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, challenge_date)
);

-- Verificar
SELECT
  (SELECT COUNT(*) FROM training_answers) AS training_answers,
  (SELECT COUNT(*) FROM training_daily) AS training_daily;
