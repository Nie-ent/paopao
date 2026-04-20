"use server"

import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import prisma from "@/lib/db"

export async function signInWithLineDirect(formData: FormData) {
  const lineIdOrName = formData.get("lineId") as string
  if (!lineIdOrName) return redirect("/login?error=Please%20enter%20your%20LINE%20ID")
  
  // Find user by name or lineId
  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { lineId: lineIdOrName },
        { name: lineIdOrName }
      ]
    }
  })

  // If user doesn't exist, create a mock one so they can test the dashboard MVP natively
  if (!user) {
    user = await prisma.user.create({
      data: {
        lineId: lineIdOrName.toLowerCase().replace(/\s+/g, '_'),
        name: lineIdOrName
      }
    })
  }

  const cookieStore = await cookies()
  cookieStore.set("direct_line_session", user.lineId, { maxAge: 60 * 60 * 24 * 30 })
  redirect("/")
}

export async function signInAsDemo() {
  const cookieStore = await cookies()
  cookieStore.set("demo_mode_bypass", "true", { maxAge: 60 * 60 * 24 * 7 })
  redirect("/")
}

export async function signOut() {
  const cookieStore = await cookies()
  cookieStore.delete("demo_mode_bypass")
  cookieStore.delete("direct_line_session")
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
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
