-- Agregar soporte de torneos a La Cajita Poker

-- 1. Crear tabla tournaments
CREATE TABLE IF NOT EXISTS tournaments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  closed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL, -- null = activo
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Agregar tournament_id a matches y active_matches (nullable para la migración)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES tournaments(id);
ALTER TABLE active_matches ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES tournaments(id);

-- 3. Crear el torneo existente y asignar todas las partidas históricas
DO $$
DECLARE
  v_tournament_id UUID;
BEGIN
  INSERT INTO tournaments (name) VALUES ('Torneo Poker 2025')
  RETURNING id INTO v_tournament_id;

  -- Asignar todas las partidas existentes a este torneo
  UPDATE matches SET tournament_id = v_tournament_id WHERE tournament_id IS NULL;

  RAISE NOTICE 'Torneo creado con id: %', v_tournament_id;
  RAISE NOTICE 'Partidas asignadas: %', (SELECT COUNT(*) FROM matches WHERE tournament_id = v_tournament_id);
END $$;

-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_matches_tournament_id ON matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_active_matches_tournament_id ON active_matches(tournament_id);

-- Verificar resultado
SELECT t.name, COUNT(m.id) AS partidas
FROM tournaments t
LEFT JOIN matches m ON m.tournament_id = t.id
GROUP BY t.id, t.name;
