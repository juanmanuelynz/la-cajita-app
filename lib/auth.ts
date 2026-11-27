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
 * "truco": el PIN de Truco (TRUCO_PIN), solo La Cajita Truco y sin ver a
 *          nadie del grupo (para compartir Truco con gente de afuera).
 */
export type AuthRole = "admin" | "guest" | "truco"

/** PIN de cada rol que no es admin. La sesión de esos roles queda atada a su PIN. */
export type RolePins = { guest?: string; truco?: string }

/** Los PIN de invitado y de Truco, de las variables de entorno (solo servidor/middleware). */
export function rolePins(): RolePins {
  return { guest: process.env.GUEST_PIN || undefined, truco: process.env.TRUCO_PIN || undefined }
}

// Clave de la firma. Admin: el secret solo (igual que siempre, así las
// sesiones del grupo siguen valiendo). Invitado y Truco: el secret más su PIN,
// así cambiar ese PIN en Vercel cierra solo las sesiones de ese PIN.
function keyFor(secret: string, role: AuthRole, pins: RolePins): string | null {
  if (role === "admin") return secret
  const pin = pins[role]
  return pin ? `${secret}:${role}:${pin}` : null
}

// Formato del token: `${expiry}.${sig}` (admin; igual que antes) o
// `${expiry}.${rol}.${sig}`. La firma cubre todo lo anterior al último punto,
// así que el rol no se puede editar.
export async function makeToken(secret: string, role: AuthRole = "admin", pins: RolePins = {}): Promise<string> {
  const key = keyFor(secret, role, pins)
  if (!key) throw new Error(`Falta el PIN del rol ${role}`)
  const expiry = Date.now() + AUTH_MAX_AGE_SECONDS * 1000
  const payload = role === "admin" ? `${expiry}` : `${expiry}.${role}`
  const sig = await hmacHex(payload, key)
  return `${payload}.${sig}`
}

/** Devuelve el rol del token si es válido y no venció; si no, null. */
export async function verifyToken(
  token: string | undefined,
  secret: string,
  pins: RolePins = {},
): Promise<AuthRole | null> {
  if (!token) return null
  const parts = token.split(".")
  if (parts.length !== 2 && parts.length !== 3) return null
  const role: AuthRole | null =
    parts.length === 2 ? "admin" : parts[1] === "guest" || parts[1] === "truco" ? parts[1] : null
  if (!role) return null
  const key = keyFor(secret, role, pins)
  if (!key) return null
  const sig = parts[parts.length - 1]
  const payload = parts.slice(0, -1).join(".")
  const expected = await hmacHex(payload, key)
  if (!timingSafeEqual(sig, expected)) return null
  const expiry = Number(parts[0])
  if (isNaN(expiry) || expiry < Date.now()) return null
  return role
}

export function verifyPin(input: string, expected: string): boolean {
  return timingSafeEqual(input, expected)
}
