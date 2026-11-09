"use server"

import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import prisma from "@/lib/db"
import { ensureDemoData } from "@/features/demo/seed"
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session"
import { verifyLiffAccessToken } from "@/lib/line-login"
import { resolveLineId } from "@/lib/auth-user"
import { signInCookies, upsertLineUser } from "@/lib/line-user"
import { attachReferral, REFERRAL_COOKIE } from "@/lib/referral"

/**
 * Sign-in is LINE only: inside LINE through LIFF (this action), on the web through LINE Login
 * (/api/auth/line). Both verify the user with LINE; the client never chooses its own user id.
 */
export async function signInWithLiffAction(accessToken: string) {
  const profile = await verifyLiffAccessToken(accessToken)
  if (!profile) return redirect("/login?error=line_failed")

  const user = await upsertLineUser({ userId: profile.userId, name: profile.displayName, picture: profile.pictureUrl ?? null })
  const signIn = await signInCookies(user)
  if (!signIn) return redirect("/login?error=line_not_configured")

  const cookieStore = await cookies()
  // Signed up through a friend's invite link: link the new account (no-op for existing ones)
  const refCode = cookieStore.get(REFERRAL_COOKIE)?.value
  if (refCode) {
    await attachReferral(user, refCode).catch(e => console.error("[referral] attach", e))
    cookieStore.delete(REFERRAL_COOKIE)
  }
  for (const c of signIn) cookieStore.set(c.name, c.value, c.options)
  cookieStore.delete("demo_mode_bypass")
  redirect(user.hasAcceptedPDPA ? "/" : "/pdpa")
}

export async function signInAsDemo() {
  await ensureDemoData()
  const cookieStore = await cookies()
  cookieStore.set("demo_mode_bypass", "true", { maxAge: 60 * 60 * 24 * 7, path: '/' })
  cookieStore.set("pdpa_accepted", "true", { maxAge: 60 * 60 * 24 * 7, path: '/' })
  redirect("/")
}

export async function signOut() {
  const cookieStore = await cookies()
  cookieStore.delete("demo_mode_bypass")
  cookieStore.delete(SESSION_COOKIE)
  cookieStore.delete("pdpa_accepted")
  redirect("/login")
}

export async function acceptPDPA() {
  const userObj = await getUser()
  const cookieStore = await cookies()

  if (!userObj || userObj.id === "demo") {
    cookieStore.set("pdpa_accepted", "true", { maxAge: 60 * 60 * 24 * 30, path: '/' })
    redirect("/")
  }

  // Recorded for the user of the verified session
  const lineId = resolveLineId(userObj)
  if (lineId) {
    try {
      await prisma.user.update({ where: { lineId }, data: { hasAcceptedPDPA: true } })
    } catch (error) {
      console.error("Failed to update PDPA acceptance:", error)
    }
  }

  cookieStore.set("pdpa_accepted", "true", { maxAge: 60 * 60 * 24 * 30, path: '/' })
  redirect("/")
}

/** The signed-in identity: a signed LINE session, or the shared demo account. Null otherwise. */
export async function getUser() {
  const cookieStore = await cookies()

  // A missing, forged or expired session cookie is ignored
  const lineId = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value)
  if (lineId) {
    return { id: lineId, app_metadata: { provider: 'line' }, user_metadata: { provider_id: lineId } }
  }

  if (cookieStore.get("demo_mode_bypass")?.value === "true") {
    return { id: "demo", app_metadata: { provider: 'demo' } }
  }

  return null
}
