import { NextResponse } from "next/server"
import { completeLineLogin, decodeOAuthCookie, loginChannel, OAUTH_COOKIE, stateMatches } from "@/lib/line-oauth"
import { signInCookies, upsertLineUser } from "@/lib/line-user"

function readCookie(req: Request, name: string) {
  const pair = (req.headers.get("cookie") ?? "").split(/;\s*/).find(c => c.startsWith(`${name}=`))
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : null
}

/** LINE redirects here after the user signs in (or cancels). */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const origin = url.origin
  const session = decodeOAuthCookie(readCookie(req, OAUTH_COOKIE))

  const fail = (code: string) => {
    const res = NextResponse.redirect(`${origin}/login?error=${code}`)
    res.cookies.set(OAUTH_COOKIE, "", { path: "/api/auth/line", maxAge: 0 })
    return res
  }

  if (url.searchParams.get("error")) return fail(url.searchParams.get("error") === "ACCESS_DENIED" ? "line_cancelled" : "line_failed")
  const channel = loginChannel()
  if (!channel) return fail("line_not_configured")
  // The state must be the one we issued to this browser (CSRF / login-fixation protection)
  if (!session || !stateMatches(session.state, url.searchParams.get("state"))) return fail("line_expired")
  const code = url.searchParams.get("code")
  if (!code) return fail("line_failed")

  const identity = await completeLineLogin({ code, redirectUri: `${origin}/api/auth/line/callback`, session, channel })
  if (!identity) return fail("line_failed")

  const user = await upsertLineUser(identity)
  const signIn = await signInCookies(user)
  if (!signIn) return fail("line_not_configured")

  const res = NextResponse.redirect(`${origin}${user.hasAcceptedPDPA ? "/" : "/pdpa"}`)
  for (const c of signIn) res.cookies.set(c.name, c.value, c.options)
  // Leaving demo mode: a real account wins
  res.cookies.set("demo_mode_bypass", "", { path: "/", maxAge: 0 })
  res.cookies.set(OAUTH_COOKIE, "", { path: "/api/auth/line", maxAge: 0 })
  return res
}
