// Rol de la sesión actual, leído de la cookie firmada. Solo para código de
// servidor (Server Actions): usa next/headers.
import { cookies } from "next/headers"
import { AUTH_COOKIE_NAME, rolePins, verifyToken, type AuthRole } from "./auth"

export async function getCurrentRole(): Promise<AuthRole> {
  const secret = process.env.APP_SECRET
  // Mismo criterio que el middleware: sin APP_SECRET no hay auth (fail-open).
  if (!secret) return "admin"
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value
  const role = await verifyToken(token, secret, rolePins())
  if (!role) throw new Error("Sesión vencida: volvé a ingresar el PIN")
  return role
}

export async function requireAdmin(): Promise<void> {
  if ((await getCurrentRole()) !== "admin") {
    throw new Error("No tenés permiso para esto")
  }
}

/** Todo lo de Poker (y la lista de jugadores del grupo): el admin y el invitado, nunca la sesión de Truco. */
export async function requirePoker(): Promise<AuthRole> {
  const role = await getCurrentRole()
  if (role === "truco") throw new Error("No tenés permiso para esto")
  return role
}
