/**
 * Signed LINE session cookie: `<lineId>.<expiresAt>.<signature>`. The signature is an HMAC over the
 * first two parts, so the cookie can't be forged or extended without the server secret. Uses Web
 * Crypto so the same code runs in middleware and on the server.
 */

export const SESSION_COOKIE = "direct_line_session"
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

const encoder = new TextEncoder()

function toBase64Url(bytes: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/** SESSION_SECRET if configured, otherwise a key derived from the LINE channel secret (always set in production). */
function sessionSecret() {
  const explicit = process.env.SESSION_SECRET
  if (explicit) return explicit
  const lineSecret = process.env.LINE_CHANNEL_SECRET
  return lineSecret ? `paopao-session:${lineSecret}` : null
}

async function sign(payload: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  return toBase64Url(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)))
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Creates a session token for a LINE user. Returns null when no secret is configured (fail closed). */
export async function createSessionToken(lineId: string, now = Date.now()) {
  const secret = sessionSecret()
  if (!secret || !/^[\w-]+$/.test(lineId)) return null
  const expiresAt = Math.floor(now / 1000) + SESSION_MAX_AGE_SECONDS
  const payload = `${lineId}.${expiresAt}`
  return `${payload}.${await sign(payload, secret)}`
}

/** Returns the LINE user id of a valid, unexpired token, or null. */
export async function verifySessionToken(token: string | undefined | null, now = Date.now()) {
  const secret = sessionSecret()
  if (!secret || !token) return null
  const parts = token.split(".")
  if (parts.length !== 3) return null
  const [lineId, expiresAt, signature] = parts
  if (!/^[\w-]+$/.test(lineId) || !/^\d+$/.test(expiresAt)) return null
  if (Number(expiresAt) * 1000 <= now) return null
  const expected = await sign(`${lineId}.${expiresAt}`, secret)
  return constantTimeEqual(signature, expected) ? lineId : null
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
}
