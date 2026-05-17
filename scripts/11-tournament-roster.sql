-- Roster por torneo: cada torneo declara qué jugadores participan.
-- Reemplaza el intento previo de archived_at global sobre players.
--
-- - El dropdown de partidas activas filtra por roster del torneo actual.
-- - Un jugador puede estar en varios torneos simultáneamente.
-- - Sacarlo de un torneo no afecta a los demás ni borra su historial.

ALTER TABLE players DROP COLUMN IF EXISTS archived_at;

CREATE TABLE IF NOT EXISTS tournament_players (
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id     UUID NOT NULL REFERENCES players(id)     ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tournament_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_tournament_players_tournament
  ON tournament_players(tournament_id);

-- Sembrar el roster histórico:
-- Poker 2025 → todos los que ya tienen match_players ahí (incluye Tito).
-- Apertura 2026 → mismo set, menos Tito (pedido explícito).

INSERT INTO tournament_players (tournament_id, player_id)
SELECT DISTINCT m.tournament_id, mp.player_id
FROM match_players mp
JOIN matches m ON m.id = mp.match_id
ON CONFLICT DO NOTHING;

-- Apertura 2026: sembrar a partir del roster de Poker 2025 menos Tito.
-- Solo aplica si el torneo no tiene roster propio todavía (es un seed,
-- no debe pisar configuración manual posterior).
INSERT INTO tournament_players (tournament_id, player_id)
SELECT
  '274d2c4c-967f-42a8-8ebb-9f2014b520d1'::uuid AS tournament_id,
  tp.player_id
FROM tournament_players tp
JOIN players p ON p.id = tp.player_id
WHERE tp.tournament_id = '92bb3581-4cb9-4f04-86a3-f2d3f8be1b1a'
  AND p.name <> 'Tito'
  AND NOT EXISTS (
    SELECT 1 FROM tournament_players existing
    WHERE existing.tournament_id = '274d2c4c-967f-42a8-8ebb-9f2014b520d1'::uuid
      AND existing.player_id = tp.player_id
  );
