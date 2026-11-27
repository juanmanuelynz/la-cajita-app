// Migraciones idempotentes que corren en cada build de Vercel, antes de
// `next build` (ver vercel.json). Así el schema siempre está al día cuando
// sale el código nuevo, sin tener que correr psql a mano.
//
// Reglas: cada sentencia tiene que ser idempotente (IF NOT EXISTS, etc.) y
// compatible con el código anterior, porque corre antes de publicar el deploy.
// Si algo falla, el build se corta y producción queda como estaba.

import { neon } from "@neondatabase/serverless"

const MIGRATIONS = [
  // 12-casual-matches.sql: partidas sueltas (no suman al torneo).
  "ALTER TABLE matches ADD COLUMN IF NOT EXISTS is_casual BOOLEAN NOT NULL DEFAULT false",
  "ALTER TABLE active_matches ADD COLUMN IF NOT EXISTS is_casual BOOLEAN NOT NULL DEFAULT false",
  // 13-training.sql: progreso de la pestaña Entrenar y Desafío del día.
  `CREATE TABLE IF NOT EXISTS training_answers (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player_id  UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    drill      TEXT NOT NULL,
    game       TEXT NOT NULL,
    deck       TEXT NOT NULL,
    correct    BOOLEAN NOT NULL,
    local_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  "CREATE INDEX IF NOT EXISTS training_answers_player_date ON training_answers (player_id, local_date)",
  `CREATE TABLE IF NOT EXISTS training_daily (
    player_id      UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    challenge_date DATE NOT NULL,
    score          INTEGER NOT NULL,
    total          INTEGER NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (player_id, challenge_date)
  )`,
  // 14-training-street-seat.sql: calle y lugar de cada respuesta (nullables).
  "ALTER TABLE training_answers ADD COLUMN IF NOT EXISTS street TEXT",
  "ALTER TABLE training_answers ADD COLUMN IF NOT EXISTS seat TEXT",
  // 15-truco.sql: progreso de Practicar en La Cajita Truco.
  `CREATE TABLE IF NOT EXISTS truco_answers (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player_id  UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    quiz       TEXT NOT NULL,
    correct    BOOLEAN NOT NULL,
    local_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  "CREATE INDEX IF NOT EXISTS truco_answers_player_date ON truco_answers (player_id, local_date)",
]

const url = process.env.DATABASE_URL
if (!url) {
  if (process.env.VERCEL) {
    console.error("[migrate] DATABASE_URL no está definida en Vercel")
    process.exit(1)
  }
  console.log("[migrate] sin DATABASE_URL (build local): salteo migraciones")
  process.exit(0)
}

const sql = neon(url)
for (const statement of MIGRATIONS) {
  await sql.query(statement)
  console.log(`[migrate] ok: ${statement}`)
}
