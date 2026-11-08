import { createHash } from "crypto"
import { afterEach, describe, expect, it, vi } from "vitest"
import { authorizeUrl, completeLineLogin, decodeOAuthCookie, encodeOAuthCookie, loginChannel, newOAuthSession, stateMatches } from "./line-oauth"

const channel = { id: "1234567890", secret: "s3cret" }
const redirectUri = "https://paopao.example/api/auth/line/callback"
const USER = "U" + "a".repeat(32)
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

describe("authorization request", () => {
  it("has every parameter LINE needs, with PKCE (S256) and the add-friend prompt", () => {
    const session = newOAuthSession()
    const url = new URL(authorizeUrl({ channelId: channel.id, redirectUri, session }))
    expect(url.origin + url.pathname).toBe("https://access.line.me/oauth2/v2.1/authorize")
    const p = url.searchParams
    expect(p.get("response_type")).toBe("code")
    expect(p.get("client_id")).toBe(channel.id)
    expect(p.get("redirect_uri")).toBe(redirectUri)
    expect(p.get("state")).toBe(session.state)
    expect(p.get("nonce")).toBe(session.nonce)
    expect(p.get("scope")).toBe("profile openid")
    expect(url.search).toContain("scope=profile%20openid") // LINE wants %20, not +
    expect(p.get("code_challenge_method")).toBe("S256")
    const expected = createHash("sha256").update(session.verifier).digest("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
    expect(p.get("code_challenge")).toBe(expected)
    expect(p.get("bot_prompt")).toBe("aggressive")
  })

  it("state and nonce are random, alphanumeric and unique per attempt", () => {
    const a = newOAuthSession(), b = newOAuthSession()
    expect(a.state).toMatch(/^[0-9a-f]{32}$/)
    expect(a.nonce).toMatch(/^[0-9a-f]{32}$/)
    expect(a.verifier.length).toBeGreaterThanOrEqual(43)
    expect(a.state).not.toBe(b.state)
  })
})

describe("oauth cookie", () => {
  it("round-trips and rejects tampered values", () => {
    const s = newOAuthSession()
    expect(decodeOAuthCookie(encodeOAuthCookie(s))).toEqual(s)
    for (const bad of [undefined, "", "x.y.z", `${s.state}.${s.nonce}`, `${s.state}.${s.nonce}.${s.verifier}.extra`, `${s.state.toUpperCase()}.${s.nonce}.${s.verifier}`]) {
      expect(decodeOAuthCookie(bad)).toBeNull()
    }
  })

  it("state comparison", () => {
    expect(stateMatches("abc", "abc")).toBe(true)
    expect(stateMatches("abc", "abd")).toBe(false)
    expect(stateMatches("abc", null)).toBe(false)
    expect(stateMatches("abc", "abcd")).toBe(false)
  })
})

describe("loginChannel", () => {
  afterEach(() => vi.unstubAllEnvs())
  it("needs the LINE Login secret; the id comes from the LIFF ID", () => {
    vi.stubEnv("NEXT_PUBLIC_LIFF_ID", "1234567890-AbCd")
    vi.stubEnv("LINE_LOGIN_CHANNEL_SECRET", "")
    expect(loginChannel()).toBeNull()
    vi.stubEnv("LINE_LOGIN_CHANNEL_SECRET", "x")
    expect(loginChannel()).toEqual({ id: "1234567890", secret: "x" })
  })
})

describe("completeLineLogin", () => {
  const session = newOAuthSession()
  const claims = (over: Record<string, unknown> = {}) => ({
    iss: "https://access.line.me", sub: USER, aud: channel.id, nonce: session.nonce,
    exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000), name: "Nie", picture: "https://profile.line-scdn.net/x", ...over,
  })
  const run = (verifyBody: unknown, tokenRes: Response = json({ access_token: "a", id_token: "jwt" }), verifyStatus = 200) => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(tokenRes)
      .mockResolvedValueOnce(json(verifyBody, verifyStatus))
    return { fetchImpl, result: completeLineLogin({ code: "c0de", redirectUri, session, channel, fetchImpl: fetchImpl as unknown as typeof fetch }) }
  }

  it("exchanges the code with PKCE and returns the verified LINE user", async () => {
    const { fetchImpl, result } = run(claims())
    expect(await result).toEqual({ userId: USER, name: "Nie", picture: "https://profile.line-scdn.net/x" })
    const [tokenUrl, tokenInit] = fetchImpl.mock.calls[0]
    expect(tokenUrl).toBe("https://api.line.me/oauth2/v2.1/token")
    const body = new URLSearchParams(tokenInit.body)
    expect(Object.fromEntries(body)).toMatchObject({ grant_type: "authorization_code", code: "c0de", redirect_uri: redirectUri, client_id: channel.id, client_secret: channel.secret, code_verifier: session.verifier })
    const [verifyUrl, verifyInit] = fetchImpl.mock.calls[1]
    expect(verifyUrl).toBe("https://api.line.me/oauth2/v2.1/verify")
    expect(Object.fromEntries(new URLSearchParams(verifyInit.body))).toEqual({ id_token: "jwt", client_id: channel.id, nonce: session.nonce })
  })

  it("rejects a failed code exchange without verifying anything", async () => {
    const { fetchImpl, result } = run(claims(), json({ error: "invalid_grant" }, 400))
    expect(await result).toBeNull()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("rejects an ID token LINE won't verify (bad signature, expired, wrong nonce)", async () => {
    expect(await run({ error: "invalid_request", error_description: "Invalid IdToken Nonce." }, undefined, 400).result).toBeNull()
  })

  it("re-checks issuer, audience, nonce, expiry and the user id format", async () => {
    for (const bad of [{ iss: "https://evil.example" }, { aud: "999" }, { nonce: "other" }, { exp: Math.floor(Date.now() / 1000) - 1 }, { sub: "U_fake" }, { sub: undefined }]) {
      expect(await run(claims(bad)).result, JSON.stringify(bad)).toBeNull()
    }
  })

  it("rejects a token response without an ID token", async () => {
    expect(await run(claims(), json({ access_token: "a" })).result).toBeNull()
  })
})
