// Rol de la sesión actual, leído de la cookie firmada. Solo para código de
// servidor (Server Actions): usa next/headers.
import { cookies } from "next/headers"
import { AUTH_COOKIE_NAME, verifyToken, type AuthRole } from "./auth"

export async function getCurrentRole(): Promise<AuthRole> {
  const secret = process.env.APP_SECRET
  // Mismo criterio que el middleware: sin APP_SECRET no hay auth (fail-open).
  if (!secret) return "admin"
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value
  const role = await verifyToken(token, secret)
  if (!role) throw new Error("Sesión vencida: volvé a ingresar el PIN")
  return role
}

export async function requireAdmin(): Promise<void> {
  if ((await getCurrentRole()) !== "admin") {
    throw new Error("No tenés permiso para esto")
  }
}
