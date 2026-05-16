import { z } from "zod"

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

const FinalMatchPlayerSchema = z.object({
  name: PlayerNameSchema,
  cajitas: z.number().int().positive("Las cajitas deben ser un entero positivo"),
  finalChips: z.number().int().min(0, "Las fichas finales no pueden ser negativas"),
  moneyWon: z.number().int(),
  tieBreak: z.number().optional(),
})

const ActiveMatchPlayerSchema = z.object({
  // Permitido vacío en draft: el usuario aún no eligió el jugador
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
    tournamentId: z.string().uuid("ID de torneo inválido"),
    players: z
      .array(FinalMatchPlayerSchema)
      .min(2, "Una partida necesita al menos 2 jugadores")
      .max(8, "Una partida no puede tener más de 8 jugadores"),
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
      const names = data.players.map((p) => p.name.toLowerCase().trim())
      return new Set(names).size === names.length
    },
    {
      message: "No puede haber jugadores duplicados en la misma partida",
      path: ["players"],
    },
  )

export const CreateActiveMatchSchema = z.object({
  date: z.string().regex(dateRegex),
  cajiValue: z.number().int().positive(),
  playerCount: z.number().int().min(2).max(8),
  tournamentId: z.string().uuid(),
  players: z.array(ActiveMatchPlayerSchema).min(2).max(8),
})

export const UpdateActiveMatchSchema = z.object({
  date: z.string().regex(dateRegex),
  cajiValue: z.number().int().positive(),
  playerCount: z.number().int().min(2).max(8),
  players: z.array(ActiveMatchPlayerSchema).min(2).max(8),
})

export const UuidSchema = z.string().uuid()

export type CreateMatchInput = z.infer<typeof CreateMatchSchema>
export type CreateActiveMatchInput = z.infer<typeof CreateActiveMatchSchema>
export type UpdateActiveMatchInput = z.infer<typeof UpdateActiveMatchSchema>
