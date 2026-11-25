import { z } from "zod"
import { DRILL_IDS } from "./poker/drill-ids"

const dateRegex = /^\d{4}-\d{2}-\d{2}$/

export const PlayerNameSchema = z
  .string()
  .trim()
  .min(1, "El nombre no puede estar vacío")
  .max(50, "El nombre no puede superar los 50 caracteres")

export const TournamentNameSchema = z
  .string()
  .trim()
  .min(1, "El nombre del torneo no puede estar vacío")
  .max(100, "El nombre del torneo no puede superar los 100 caracteres")

export const PointsConfigSchema = z
  .array(z.number().int().min(0, "Los puntos no pueden ser negativos").max(999))
  .length(8, "La distribución de puntos debe tener 8 entradas")
  .refine(
    (arr) => arr.every((v, i) => i === 0 || v <= arr[i - 1]),
    "Las posiciones inferiores no pueden tener más puntos que las superiores",
  )

const FinalMatchPlayerSchema = z.object({
  // playerId es la fuente de verdad para resolver el jugador.
  // name queda como dato denormalizado por compatibilidad con flujos legacy
  // (active_matches viejos que solo tenían el nombre).
  playerId: z.string().uuid().optional(),
  name: PlayerNameSchema,
  cajitas: z.number().int().positive("Las cajitas deben ser un entero positivo"),
  finalChips: z.number().int().min(0, "Las fichas finales no pueden ser negativas"),
  moneyWon: z.number().int(),
  tieBreak: z.number().optional(),
})

const ActiveMatchPlayerSchema = z.object({
  // Permitido vacío en draft: el usuario aún no eligió el jugador
  playerId: z.string().uuid().optional(),
  name: z.string().trim().max(50),
  cajitas: z.number().int().positive(),
  finalChips: z.number().int().min(0),
  moneyWon: z.number().int(),
  tieBreak: z.number().optional(),
})

export const CreateMatchSchema = z
  .object({
    date: z.string().regex(dateRegex, "La fecha debe estar en formato YYYY-MM-DD"),
    cajiValue: z.number().int().positive("El valor de la cajita debe ser positivo"),
    // Las sueltas no pertenecen a ningún torneo: ahí puede faltar.
    tournamentId: z.string().uuid("ID de torneo inválido").nullish(),
    // Suelta: se registra pero no reparte puntos ni cuenta para el torneo.
    isCasual: z.boolean().optional().default(false),
    players: z
      .array(FinalMatchPlayerSchema)
      .min(2, "Una partida necesita al menos 2 jugadores")
      .max(8, "Una partida no puede tener más de 8 jugadores"),
  })
  .refine((data) => data.isCasual || !!data.tournamentId, {
    message: "Falta el torneo de la partida",
    path: ["tournamentId"],
  })
  .refine(
    (data) => {
      const totalInvestment = data.players.reduce(
        (sum, p) => sum + p.cajitas * data.cajiValue,
        0,
      )
      const totalFinalChips = data.players.reduce((sum, p) => sum + p.finalChips, 0)
      return Math.abs(totalInvestment - totalFinalChips) < 0.01
    },
    {
      message:
        "La suma de fichas finales debe igualar el total invertido en cajitas",
      path: ["players"],
    },
  )
  .refine(
    (data) => {
      // Dedup por playerId si existe (la identidad real), si no por nombre.
      const keys = data.players.map((p) =>
        p.playerId ?? p.name.toLowerCase().trim(),
      )
      return new Set(keys).size === keys.length
    },
    {
      message: "No puede haber jugadores duplicados en la misma partida",
      path: ["players"],
    },
  )

export const CreateActiveMatchSchema = z
  .object({
    date: z.string().regex(dateRegex),
    cajiValue: z.number().int().positive(),
    playerCount: z.number().int().min(2).max(8),
    // Las sueltas no pertenecen a ningún torneo: ahí puede faltar.
    tournamentId: z.string().uuid().nullish(),
    isCasual: z.boolean().optional().default(false),
    players: z.array(ActiveMatchPlayerSchema).min(2).max(8),
  })
  .refine((data) => data.isCasual || !!data.tournamentId, {
    message: "Falta el torneo de la partida",
    path: ["tournamentId"],
  })

export const UpdateActiveMatchSchema = z.object({
  date: z.string().regex(dateRegex),
  cajiValue: z.number().int().positive(),
  playerCount: z.number().int().min(2).max(8),
  players: z.array(ActiveMatchPlayerSchema).min(2).max(8),
})

export const UuidSchema = z.string().uuid()

export const DateSchema = z.string().regex(dateRegex)

export type CreateMatchInput = z.infer<typeof CreateMatchSchema>
export type CreateActiveMatchInput = z.infer<typeof CreateActiveMatchSchema>
export type UpdateActiveMatchInput = z.infer<typeof UpdateActiveMatchSchema>

// ── Entrenar ────────────────────────────────────────────────────────────────

export const TrainingAnswerSchema = z.object({
  playerId: z.string().uuid(),
  drill: z.enum(DRILL_IDS),
  game: z.enum(["holdem", "omaha", "manhattan"]),
  deck: z.enum(["long", "short"]),
  correct: z.boolean(),
  localDate: z.string().regex(dateRegex),
  /** En qué calle fue la decisión y desde qué lugar (null si no aplica). */
  street: z.enum(["preflop", "flop", "turn", "river"]).nullish(),
  seat: z.enum(["primero", "medio", "reparte", "ciega"]).nullish(),
})

export const DailyResultSchema = z
  .object({
    playerId: z.string().uuid(),
    date: z.string().regex(dateRegex),
    score: z.number().int().min(0),
    total: z.number().int().min(1).max(50),
  })
  .refine((r) => r.score <= r.total, "El puntaje no puede superar el total")

export type TrainingAnswerInput = z.infer<typeof TrainingAnswerSchema>
export type DailyResultInput = z.infer<typeof DailyResultSchema>
