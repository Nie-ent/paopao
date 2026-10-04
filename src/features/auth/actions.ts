"use server"

import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import prisma from "@/lib/db"
import { ensureDemoData } from "@/features/demo/seed"

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

  const cookieStore = await cookies()
  cookieStore.set("direct_line_session", user.lineId, { maxAge: 60 * 60 * 24 * 30, path: '/' })
  
  if (!user.hasAcceptedPDPA) {
    redirect("/pdpa")
  } else {
    cookieStore.set("pdpa_accepted", "true", { maxAge: 60 * 60 * 24 * 30, path: '/' })
    redirect("/")
  }
}

export async function signInWithLiffAction(lineId: string, displayName: string, avatarUrl: string) {
  if (!lineId) return redirect("/login?error=Invalid%20LIFF%20Profile")
  
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

  const cookieStore = await cookies()
  cookieStore.set("direct_line_session", user.lineId, { maxAge: 60 * 60 * 24 * 30, path: '/' })
  
  if (!user.hasAcceptedPDPA) {
    redirect("/pdpa")
  } else {
    cookieStore.set("pdpa_accepted", "true", { maxAge: 60 * 60 * 24 * 30, path: '/' })
    redirect("/")
  }
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
  cookieStore.delete("direct_line_session")
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

  // Update in DB
  let lineId = cookieStore.get("direct_line_session")?.value

  if (!lineId) {
    if (userObj.app_metadata?.provider === "line") {
      lineId = (userObj as any).user_metadata.provider_id
    } else if (userObj.id) {
      lineId = userObj.id // Magic fallback
    }
  }

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
  
  // 1. Check Magic Direct LINE Session
  const directSession = cookieStore.get("direct_line_session")?.value
  if (directSession) {
    return { 
      id: directSession, 
      email: null, 
      app_metadata: { provider: 'line' },
      user_metadata: { provider_id: directSession }
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
