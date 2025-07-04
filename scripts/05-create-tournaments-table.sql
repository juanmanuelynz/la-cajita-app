-- Create tournaments table
CREATE TABLE IF NOT EXISTS tournaments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  year INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add tournament_id to matches table
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_matches_tournament_id ON matches(tournament_id);

-- Insert default tournament "Poker y Faso 2025"
INSERT INTO tournaments (name, year) 
VALUES ('Poker y Faso 2025', 2025)
ON CONFLICT DO NOTHING;

-- Update existing matches to belong to the default tournament
UPDATE matches 
SET tournament_id = (
  SELECT id FROM tournaments WHERE name = 'Poker y Faso 2025' LIMIT 1
)
WHERE tournament_id IS NULL;

-- Add tournament_id to active_matches table as well
ALTER TABLE active_matches 
ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL;

-- Update existing active matches to belong to the default tournament
UPDATE active_matches 
SET tournament_id = (
  SELECT id FROM tournaments WHERE name = 'Poker y Faso 2025' LIMIT 1
)
WHERE tournament_id IS NULL;
