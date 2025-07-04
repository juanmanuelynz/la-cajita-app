-- Create active_matches table for draft matches that sync across devices
CREATE TABLE IF NOT EXISTS active_matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  caji_value INTEGER NOT NULL,
  player_count INTEGER NOT NULL,
  players JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_active_matches_created_at ON active_matches(created_at);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_active_matches_updated_at 
    BEFORE UPDATE ON active_matches 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
