-- Jugadores anotados desde Truco: no aparecen en ninguna lista de Poker.
-- La sesión de Truco (TRUCO_PIN) solo crea y usa jugadores así. Al agregar la
-- columna se marcan los que solo practicaron Truco y nunca hicieron nada en
-- Poker. En la base de producción lo aplica scripts/migrate.mjs.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'truco_only'
  ) THEN
    ALTER TABLE players ADD COLUMN truco_only BOOLEAN NOT NULL DEFAULT false;
    UPDATE players p SET truco_only = true
    WHERE EXISTS (SELECT 1 FROM truco_answers WHERE player_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM tournament_players WHERE player_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM match_players WHERE player_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM training_answers WHERE player_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM training_daily WHERE player_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM active_matches WHERE players::text LIKE '%' || p.id::text || '%');
  END IF;
END $$;
