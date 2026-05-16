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

export async function makeToken(secret: string): Promise<string> {
  const expiry = Date.now() + AUTH_MAX_AGE_SECONDS * 1000
  const payload = `${expiry}`
  const sig = await hmacHex(payload, secret)
  return `${payload}.${sig}`
}

export async function verifyToken(
  token: string | undefined,
  secret: string,
): Promise<boolean> {
  if (!token) return false
  const parts = token.split(".")
  if (parts.length !== 2) return false
  const [payload, sig] = parts
  const expected = await hmacHex(payload, secret)
  if (!timingSafeEqual(sig, expected)) return false
  const expiry = Number(payload)
  if (isNaN(expiry) || expiry < Date.now()) return false
  return true
}

export function verifyPin(input: string, expected: string): boolean {
  return timingSafeEqual(input, expected)
}
