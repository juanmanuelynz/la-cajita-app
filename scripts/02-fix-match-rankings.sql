-- Script to fix match rankings based on money won (net gain/loss) instead of final chips
-- This will recalculate positions and points for all existing matches

-- First, let's create a temporary function to recalculate rankings
DO $$
DECLARE
    match_record RECORD;
    player_record RECORD;
    new_position INTEGER;
    new_points INTEGER;
    points_distribution INTEGER[] := ARRAY[25, 18, 15, 12, 10, 8, 6, 4];
BEGIN
    -- Loop through each match
    FOR match_record IN 
        SELECT DISTINCT match_id 
        FROM match_players 
        ORDER BY match_id
    LOOP
        -- Reset position counter
        new_position := 1;
        
        -- Loop through players in this match, ordered by money_won DESC, then cajitas ASC
        FOR player_record IN
            SELECT id, money_won, cajitas
            FROM match_players 
            WHERE match_id = match_record.match_id
            ORDER BY money_won DESC, cajitas ASC
        LOOP
            -- Calculate points based on position
            IF new_position <= array_length(points_distribution, 1) THEN
                new_points := points_distribution[new_position];
            ELSE
                new_points := 0;
            END IF;
            
            -- Update the player's position and points
            UPDATE match_players 
            SET 
                position = new_position,
                points = new_points
            WHERE id = player_record.id;
            
            -- Increment position for next player
            new_position := new_position + 1;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Match rankings have been recalculated based on money won (net gain/loss)';
END $$;
