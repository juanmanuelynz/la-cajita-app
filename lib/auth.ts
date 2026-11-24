// Auth helpers compatibles con Edge runtime (middleware) y Node runtime
// (server actions). Solo se usa Web Crypto API — nada de node:crypto.

export const AUTH_COOKIE_NAME = "la_cajita_auth"
export const AUTH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60 // 30 días

async function hmacHex(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sigBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  )
  return Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

/**
 * "admin": el PIN del grupo (APP_PIN), ve todo.
 * "guest": el PIN de invitado (GUEST_PIN), solo partidas sueltas y Entrenar.
 */
export type AuthRole = "admin" | "guest"

// Formato del token: `${expiry}.${sig}` (admin; igual que antes, así las
// sesiones ya abiertas siguen valiendo) o `${expiry}.guest.${sig}`. La firma
// cubre todo lo anterior al último punto, así que el rol no se puede editar.
export async function makeToken(secret: string, role: AuthRole = "admin"): Promise<string> {
  const expiry = Date.now() + AUTH_MAX_AGE_SECONDS * 1000
  const payload = role === "guest" ? `${expiry}.guest` : `${expiry}`
  const sig = await hmacHex(payload, secret)
  return `${payload}.${sig}`
}

/** Devuelve el rol del token si es válido y no venció; si no, null. */
export async function verifyToken(
  token: string | undefined,
  secret: string,
): Promise<AuthRole | null> {
  if (!token) return null
  const parts = token.split(".")
  if (parts.length !== 2 && parts.length !== 3) return null
  if (parts.length === 3 && parts[1] !== "guest") return null
  const sig = parts[parts.length - 1]
  const payload = parts.slice(0, -1).join(".")
  const expected = await hmacHex(payload, secret)
  if (!timingSafeEqual(sig, expected)) return null
  const expiry = Number(parts[0])
  if (isNaN(expiry) || expiry < Date.now()) return null
  return parts.length === 3 ? "guest" : "admin"
}

export function verifyPin(input: string, expected: string): boolean {
  return timingSafeEqual(input, expected)
}
