-- Entrenar: calle y lugar de cada respuesta (fase 5 del plan Runout), para
-- mostrar aciertos por calle y por lugar en la mesa. Nullables: las respuestas
-- viejas no los tienen. La calle de los ejercicios que siempre son en la misma
-- calle se deduce al leer (ver getTrainingProgress); "Outs" y "¿Call o fold?"
-- (flop o turn) cuentan solo desde que se guarda.

ALTER TABLE training_answers ADD COLUMN IF NOT EXISTS street TEXT;
ALTER TABLE training_answers ADD COLUMN IF NOT EXISTS seat TEXT;
