"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import {
  AUTH_COOKIE_NAME,
  AUTH_MAX_AGE_SECONDS,
  makeToken,
  rolePins,
  verifyPin,
  type AuthRole,
} from "@/lib/auth"
import { LAST_APP_COOKIE } from "@/lib/last-app"

export interface LoginState {
  error: string | null
  ok?: boolean
  /** A qué app entra (la sesión de Truco solo puede ir a /truco). */
  app?: "poker" | "truco"
}

// En éxito no redirige desde el server: devuelve ok y el cliente navega a "/"
// después de la animación de la cajita abriéndose. La cookie ya queda seteada.
export async function login(
  _prevState: LoginState | null,
  formData: FormData,
): Promise<LoginState> {
  const pin = String(formData.get("pin") || "")
  const expected = process.env.APP_PIN
  // PIN de invitado (opcional): entra solo a sueltas y Entrenar.
  // PIN de Truco (opcional): entra solo a Truco, sin ver a nadie del grupo.
  const pins = rolePins()
  const secret = process.env.APP_SECRET

  if (!expected || !secret) {
    return { error: "Auth no configurada en el servidor" }
  }

  // Un PIN repetido entre roles no cuenta para el rol de menor nivel.
  let role: AuthRole | null = null
  if (verifyPin(pin, expected)) role = "admin"
  else if (pins.guest && pins.guest !== expected && verifyPin(pin, pins.guest)) role = "guest"
  else if (pins.truco && pins.truco !== expected && pins.truco !== pins.guest && verifyPin(pin, pins.truco))
    role = "truco"
  if (!role) {
    // Pequeño delay anti-fuerza-bruta. No es protección real pero ralentiza
    // intentos manuales y enmascara cualquier diff de timing residual.
    await new Promise((r) => setTimeout(r, 500))
    return { error: "PIN incorrecto" }
  }

  const token = await makeToken(secret, role, pins)
  const cookieStore = await cookies()
  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: AUTH_MAX_AGE_SECONDS,
    path: "/",
  })
  if (role === "truco") {
    // Que la próxima vez el login ya muestre la escena de Truco.
    cookieStore.set(LAST_APP_COOKIE, "truco", { path: "/", maxAge: 31536000, sameSite: "lax" })
    return { error: null, ok: true, app: "truco" }
  }
  return { error: null, ok: true }
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete(AUTH_COOKIE_NAME)
  // Vuelve a la app (sin sesión, ahí mismo se pide el PIN).
  redirect("/")
}
