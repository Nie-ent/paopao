import { NextResponse } from "next/server"
import { authorizeUrl, encodeOAuthCookie, loginChannel, newOAuthSession, OAUTH_COOKIE, OAUTH_COOKIE_MAX_AGE } from "@/lib/line-oauth"

/** Starts "Sign in with LINE": remembers state/nonce/PKCE verifier in a short-lived cookie and sends the user to LINE. */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin
  // Inside LINE's in-app browser, LIFF signs in with one tap (LINE Login isn't supported there)
  if (/\bLine\//i.test(req.headers.get("user-agent") ?? "")) return NextResponse.redirect(`${origin}/login`)
  const channel = loginChannel()
  if (!channel) {
    console.error("LINE Login is not configured: set LINE_LOGIN_CHANNEL_SECRET (and the LIFF ID or LINE_LOGIN_CHANNEL_ID)")
    return NextResponse.redirect(`${origin}/login?error=line_not_configured`)
  }
  const session = newOAuthSession()
  const res = NextResponse.redirect(authorizeUrl({ channelId: channel.id, redirectUri: `${origin}/api/auth/line/callback`, session }))
  res.cookies.set(OAUTH_COOKIE, encodeOAuthCookie(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax: the cookie must come back on LINE's top-level redirect to our callback
    sameSite: "lax",
    path: "/api/auth/line",
    maxAge: OAUTH_COOKIE_MAX_AGE,
  })
  return res
}
