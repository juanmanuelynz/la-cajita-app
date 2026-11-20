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
