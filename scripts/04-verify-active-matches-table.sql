-- Verify that the active_matches table exists and has the correct structure
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'active_matches'
ORDER BY ordinal_position;

-- Check if there are any active matches in the database
SELECT 
    id,
    date,
    caji_value,
    player_count,
    jsonb_array_length(players) as players_count,
    created_at,
    updated_at
FROM active_matches
ORDER BY created_at DESC;

-- Check table permissions
SELECT 
    grantee, 
    privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'active_matches';
