-- Script para actualizar el sistema de puntos
-- Nuevo sistema: 1º=10, 2º=7, 3º=5, 4º=3, 5º=2, 6º=1, 7º=0, 8º=0

DO $$
DECLARE
    match_record RECORD;
    player_record RECORD;
    new_position INTEGER;
    new_points INTEGER;
    points_distribution INTEGER[] := ARRAY[10, 7, 5, 3, 2, 1, 0, 0];
BEGIN
    RAISE NOTICE 'Iniciando actualización del sistema de puntos...';
    
    -- Iterar sobre todas las partidas
    FOR match_record IN SELECT id FROM matches ORDER BY date LOOP
        RAISE NOTICE 'Procesando partida: %', match_record.id;
        
        -- Recalcular posiciones basadas en dinero ganado (mayor a menor) y cajitas (menor en caso de empate)
        WITH ranked_players AS (
            SELECT 
                id,
                ROW_NUMBER() OVER (
                    ORDER BY money_won DESC, cajitas ASC
                ) as new_position
            FROM match_players 
            WHERE match_id = match_record.id
        )
        UPDATE match_players 
        SET 
            position = ranked_players.new_position,
            points = CASE 
                WHEN ranked_players.new_position <= array_length(points_distribution, 1) 
                THEN points_distribution[ranked_players.new_position] 
                ELSE 0 
            END
        FROM ranked_players 
        WHERE match_players.id = ranked_players.id;
        
    END LOOP;
    
    RAISE NOTICE 'Actualización completada exitosamente!';
END $$;

-- Verificar resultados
SELECT 
    m.date,
    p.name,
    mp.position,
    mp.points,
    mp.money_won,
    mp.cajitas
FROM matches m
JOIN match_players mp ON m.id = mp.match_id
JOIN players p ON mp.player_id = p.id
ORDER BY m.date DESC, mp.position ASC
LIMIT 20;
