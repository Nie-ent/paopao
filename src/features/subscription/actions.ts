"use server"

import { getCurrentUser } from "@/lib/current-user"

const FREE_SLIP_LIMIT = 20

export async function getSubscriptionData() {
  const user = await getCurrentUser()
  if (!user) return null

  return {
    subscriptionTier: user.subscriptionTier,
    aiSlipsUsed: user.aiSlipsUsed,
    limit: FREE_SLIP_LIMIT
  }
}
