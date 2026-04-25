"use server"

import prisma from "@/lib/db"
import { getUser } from "@/features/auth/actions"
import { revalidatePath } from "next/cache"

export async function getSubscriptionData() {
  const userObj = await getUser()
  if (!userObj) return null

  // Resolve true lineId for LINE users
  let lineId = "demo"
  if (userObj.app_metadata?.provider === "line") {
    lineId = (userObj as any).user_metadata.provider_id
  } else if (userObj.id && userObj.id !== "demo") {
    lineId = userObj.id
  }

  if (lineId === "demo") {
    return {
      subscriptionTier: "FREE",
      aiSlipsUsed: 15,
      limit: 20
    }
  }

  const user = await prisma.user.findUnique({
    where: { lineId },
    select: {
      subscriptionTier: true,
      aiSlipsUsed: true,
      aiQuotaResetDate: true
    }
  })

  if (!user) return null

  return {
    subscriptionTier: user.subscriptionTier,
    aiSlipsUsed: user.aiSlipsUsed,
    limit: 20
  }
}

export async function upgradeToPro() {
  const userObj = await getUser()
  if (!userObj || userObj.id === "demo") return { success: false, message: "Cannot upgrade demo user" }

  let lineId = ""
  if (userObj.app_metadata?.provider === "line") {
    lineId = (userObj as any).user_metadata.provider_id
  } else {
    lineId = userObj.id
  }

  await prisma.user.update({
    where: { lineId },
    data: { subscriptionTier: "PRO" }
  })

  revalidatePath("/subscription")
  return { success: true }
}
