"use server"

import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import prisma from "@/lib/db"
import { ensureDemoData } from "@/features/demo/seed"
import { createSessionToken, verifySessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session"
import { verifyLiffAccessToken } from "@/lib/line-login"
import { resolveLineId } from "@/lib/auth-user"

/** Signs the user in with a signed session cookie and sends them on to PDPA or the dashboard. */
async function startLineSession(user: { lineId: string; hasAcceptedPDPA: boolean }) {
  const token = await createSessionToken(user.lineId)
  if (!token) return redirect("/login?error=Sign-in%20is%20not%20configured")

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions)
  if (!user.hasAcceptedPDPA) redirect("/pdpa")
  cookieStore.set("pdpa_accepted", "true", { maxAge: 60 * 60 * 24 * 30, path: '/' })
  redirect("/")
}

export async function signInWithLineDirect(formData: FormData) {
  const otpInput = formData.get("otp") as string
  if (!otpInput) return redirect("/login?error=กรุณาระบุรหัส%20OTP")
  
  // Find user by OTP and ensure it has not expired
  let user = await prisma.user.findFirst({
    where: {
      otp: otpInput,
      otpExpiresAt: {
        gt: new Date()
      }
    }
  })

  if (!user) {
    return redirect("/login?error=รหัส%20OTP%20ไม่ถูกต้องหรือหมดอายุแล้ว")
  }

  // Clear OTP to prevent reuse
  await prisma.user.update({
    where: { id: user.id },
    data: { otp: null, otpExpiresAt: null }
  })

  await startLineSession(user)
}

/**
 * LIFF sign-in. The client sends its LIFF access token; LINE tells us whose it is. Never accept a
 * user id from the client, or anyone could sign in as anyone.
 */
export async function signInWithLiffAction(accessToken: string) {
  const profile = await verifyLiffAccessToken(accessToken)
  if (!profile) return redirect("/login?error=Invalid%20LIFF%20session")
  const { userId: lineId, displayName } = profile
  const avatarUrl = profile.pictureUrl || ""

  let user = await prisma.user.findUnique({
    where: { lineId }
  })

  if (!user) {
    user = await prisma.user.create({
      data: {
        lineId,
        name: displayName,
        avatarUrl
      }
    })
  } else {
    // Sync the freshest LINE profile data automatically
    if (user.avatarUrl !== avatarUrl || user.name !== displayName) {
      user = await prisma.user.update({
        where: { lineId },
        data: { avatarUrl, name: displayName }
      });
    }
  }

  await startLineSession(user)
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
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}

export async function acceptPDPA() {
  const userObj = await getUser()
  const cookieStore = await cookies()
  
  if (!userObj || userObj.id === "demo") {
    cookieStore.set("pdpa_accepted", "true", { maxAge: 60 * 60 * 24 * 30, path: '/' })
    redirect("/")
  }

  // Update in DB, for the user of the verified session
  const lineId = resolveLineId(userObj)

  if (lineId) {
    try {
      await prisma.user.update({
        where: { lineId },
        data: { hasAcceptedPDPA: true }
      })
      console.log("PDPA updated successfully for", lineId)
    } catch (error) {
      console.error("Failed to update PDPA acceptance:", error)
      // Even if db update fails (e.g., mismatched id), allow them through for UX
    }
  }

  cookieStore.set("pdpa_accepted", "true", { maxAge: 60 * 60 * 24 * 30, path: '/' })
  redirect("/")
}

export async function getUser() {
  const cookieStore = await cookies()
  
  // 1. Signed LINE session (OTP or LIFF). A missing, forged or expired cookie is ignored.
  const lineId = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value)
  if (lineId) {
    return {
      id: lineId,
      email: null,
      app_metadata: { provider: 'line' },
      user_metadata: { provider_id: lineId }
    }
  }

  // 2. Check Demo Mode
  if (cookieStore.get("demo_mode_bypass")?.value === "true") {
    return { id: "demo", email: "demo@wealthness.app", app_metadata: { provider: 'demo' } }
  }

  // 3. Fallback to Supabase normal Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
