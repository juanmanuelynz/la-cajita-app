"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import {
  AUTH_COOKIE_NAME,
  AUTH_MAX_AGE_SECONDS,
  makeToken,
  verifyPin,
} from "@/lib/auth"

export async function login(
  _prevState: { error: string | null } | null,
  formData: FormData,
): Promise<{ error: string | null }> {
  const pin = String(formData.get("pin") || "")
  const expected = process.env.APP_PIN
  const secret = process.env.APP_SECRET

  if (!expected || !secret) {
    return { error: "Auth no configurada en el servidor" }
  }

  if (!verifyPin(pin, expected)) {
    // Pequeño delay anti-fuerza-bruta. No es protección real pero ralentiza
    // intentos manuales y enmascara cualquier diff de timing residual.
    await new Promise((r) => setTimeout(r, 500))
    return { error: "PIN incorrecto" }
  }

  const token = await makeToken(secret)
  const cookieStore = await cookies()
  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: AUTH_MAX_AGE_SECONDS,
    path: "/",
  })
  redirect("/")
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete(AUTH_COOKIE_NAME)
  redirect("/login")
}
