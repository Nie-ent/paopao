/**
 * LINE Login v2.1 (OAuth 2.0 + OpenID Connect) for signing in on the web.
 * Docs: https://developers.line.biz/en/docs/line-login/integrate-line-login/
 *
 * Flow: /api/auth/line generates state + nonce + PKCE verifier, keeps them in a short-lived
 * httpOnly cookie and redirects to LINE. LINE redirects back to /api/auth/line/callback with a
 * code; we check the state, exchange the code (with the PKCE verifier) and have LINE verify the
 * ID token against our channel ID and nonce. The LINE user id is `sub` of the verified token.
 *
 * Uses the LINE Login channel that owns the LIFF app, so users get the same id as with LIFF.
 */
import { createHash, randomBytes } from "crypto"
import { liffChannelId } from "@/lib/line-login"

export const OAUTH_COOKIE = "line_oauth"
export const OAUTH_COOKIE_MAX_AGE = 10 * 60 // the authorization code itself is valid for 10 minutes

const AUTHORIZE_URL = "https://access.line.me/oauth2/v2.1/authorize"
const TOKEN_URL = "https://api.line.me/oauth2/v2.1/token"
const VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify"
const ISSUER = "https://access.line.me"

export type OAuthSession = { state: string; nonce: string; verifier: string }
export type LineIdentity = { userId: string; name: string | null; picture: string | null }

/** Channel id + secret of the LINE Login channel, or null when web sign-in isn't configured. */
export function loginChannel() {
  const id = liffChannelId()
  const secret = process.env.LINE_LOGIN_CHANNEL_SECRET
  return id && secret ? { id, secret } : null
}

const base64url = (buf: Buffer) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

/** Fresh random values for one sign-in attempt. state and nonce are alphanumeric, as LINE requires. */
export function newOAuthSession(): OAuthSession {
  return { state: randomBytes(16).toString("hex"), nonce: randomBytes(16).toString("hex"), verifier: base64url(randomBytes(48)) }
}

export function authorizeUrl(opts: { channelId: string; redirectUri: string; session: OAuthSession }) {
  const { channelId, redirectUri, session } = opts
  const params = new URLSearchParams({
    response_type: "code",
    client_id: channelId,
    redirect_uri: redirectUri,
    state: session.state,
    scope: "profile openid",
    nonce: session.nonce,
    code_challenge: base64url(createHash("sha256").update(session.verifier).digest()),
    code_challenge_method: "S256",
    // After consent, offer to add the PaoPao LINE OA as a friend (needs the OA linked to the Login channel)
    bot_prompt: "aggressive",
    ui_locales: "th-TH",
  })
  // LINE wants spaces in scope encoded as %20, not "+"
  return `${AUTHORIZE_URL}?${params.toString().replace(/\+/g, "%20")}`
}

export function encodeOAuthCookie(session: OAuthSession) {
  return `${session.state}.${session.nonce}.${session.verifier}`
}

export function decodeOAuthCookie(value: string | undefined | null): OAuthSession | null {
  const [state, nonce, verifier, ...rest] = (value ?? "").split(".")
  if (rest.length || !/^[0-9a-f]{32}$/.test(state ?? "") || !/^[0-9a-f]{32}$/.test(nonce ?? "") || !/^[\w-]{43,128}$/.test(verifier ?? "")) return null
  return { state, nonce, verifier }
}

/** Constant-time comparison of the returned state with the one we stored. */
export function stateMatches(expected: string, received: string | null) {
  if (!received || received.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ received.charCodeAt(i)
  return diff === 0
}

/**
 * Exchanges the authorization code and verifies the ID token with LINE. Returns the identity,
 * or null when anything doesn't check out (bad code, wrong channel, nonce mismatch, expired…).
 */
export async function completeLineLogin(opts: {
  code: string; redirectUri: string; session: OAuthSession; channel: { id: string; secret: string }; fetchImpl?: typeof fetch
}): Promise<LineIdentity | null> {
  const { code, redirectUri, session, channel, fetchImpl = fetch } = opts
  const form = (fields: Record<string, string>) => ({
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
    cache: "no-store" as const,
    signal: AbortSignal.timeout(10_000),
  })

  const tokenRes = await fetchImpl(TOKEN_URL, form({
    grant_type: "authorization_code", code, redirect_uri: redirectUri,
    client_id: channel.id, client_secret: channel.secret, code_verifier: session.verifier,
  }))
  if (!tokenRes.ok) {
    console.error("LINE token exchange failed:", tokenRes.status, await tokenRes.text().catch(() => ""))
    return null
  }
  const { id_token: idToken } = (await tokenRes.json()) as { id_token?: string }
  if (!idToken) return null

  // LINE checks the signature, expiry, audience (our channel) and nonce
  const verifyRes = await fetchImpl(VERIFY_URL, form({ id_token: idToken, client_id: channel.id, nonce: session.nonce }))
  if (!verifyRes.ok) {
    console.error("LINE ID token rejected:", verifyRes.status, await verifyRes.text().catch(() => ""))
    return null
  }
  const claims = (await verifyRes.json()) as { iss?: string; sub?: string; aud?: string; nonce?: string; exp?: number; name?: string; picture?: string }
  // Belt and braces: re-check what LINE verified
  if (claims.iss !== ISSUER || claims.aud !== channel.id || claims.nonce !== session.nonce) return null
  if (!claims.exp || claims.exp * 1000 <= Date.now()) return null
  if (!claims.sub || !/^U[0-9a-f]{32}$/.test(claims.sub)) return null
  return { userId: claims.sub, name: claims.name ?? null, picture: claims.picture ?? null }
}
