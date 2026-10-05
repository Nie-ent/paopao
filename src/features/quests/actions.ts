"use server"

import prisma from "@/lib/db"
import { getProfileData } from "@/features/user/actions"

export async function claimDynamicQuest(questId: string) {
  const user = await getProfileData()
  if (!user) return { success: false, error: "Unauthorized" }

  const quest = await prisma.quest.findUnique({ where: { id: questId } })
  if (!quest || quest.status !== 'ACTIVE') return { success: false, error: "quest.error.inactive" }

  // Check claims
  const now = new Date()
  const claims = await prisma.questClaim.findMany({
    where: { userId: user.id, questId: quest.id },
    orderBy: { createdAt: 'desc' }
  })

  if (quest.type === 'ONETIME' && claims.length > 0) {
    return { success: false, error: "quest.error.claimed_once" }
  } else if (quest.type === 'DAILY' && claims.length > 0) {
    const lastClaim = new Date(claims[0].createdAt)
    // UTC midnight exactly aligns with 07:00 AM Bangkok Time
    const today = new Date(now.getTime()).toDateString()
    const claimDate = new Date(lastClaim.getTime()).toDateString()
    if (today === claimDate) {
      return { success: false, error: "quest.error.claimed_today" }
    }
  }

  // Pre-condition checking
  if (quest.condition === 'LOG_TRANSACTION_TODAY') {
    const txToday = await prisma.transaction.findFirst({
      where: { userId: user.id },
      orderBy: { date: 'desc' }
    })
    
    if (!txToday) {
      return { success: false, error: "quest.error.log_today" }
    }
    
    const txDateStr = new Date(txToday.date.getTime()).toDateString()
    const currentDateStr = new Date(now.getTime()).toDateString()
    
    if (txDateStr !== currentDateStr) {
      return { success: false, error: "quest.error.log_today" }
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { paoPoints: { increment: quest.points } }
      })
      await tx.questClaim.create({
        data: { userId: user.id, questId: quest.id }
      })
    })
    return { success: true }
  } catch (error) {
    console.error("Failed to claim dynamic quest", error)
    return { success: false, error: "common.something_wrong" }
  }
}

export async function getActiveQuests() {
  const user = await getProfileData()
  if (!user) return []
  
  return prisma.quest.findMany({
    where: { status: 'ACTIVE' },
    include: {
      claims: {
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' }
      }
    }
  })
}

export async function redeemReward(rewardId: string) {
  const user = await getProfileData()
  if (!user) return { success: false, error: "Unauthorized" }

  // 1. Fetch reward
  const reward = await prisma.reward.findUnique({ where: { id: rewardId } })
  if (!reward || reward.status !== 'AVAILABLE') {
    return { success: false, error: "rewards.error.unavailable" }
  }

  // 2. Check points
  if ((user.paoPoints || 0) < reward.points) {
    return { success: false, error: "rewards.error.not_enough_points" }
  }

  // 3. Transaction
  try {
    await prisma.$transaction(async (tx) => {
      // Deduct points
      await tx.user.update({
        where: { id: user.id },
        data: { paoPoints: { decrement: reward.points } }
      })

      // Add claim
      await tx.rewardClaim.create({
        data: {
          userId: user.id,
          rewardId: reward.id,
          status: 'PENDING'
        }
      })
    })
    return { success: true }
  } catch (error) {
    console.error("Redemption error", error)
    return { success: false, error: "common.something_wrong" }
  }
}

export async function getAvailableRewards() {
  return prisma.reward.findMany({
    where: { status: { not: 'HIDDEN' } },
    orderBy: { points: 'asc' }
  })
}

export async function getUserClaims() {
  const user = await getProfileData()
  if (!user) return []
  return prisma.rewardClaim.findMany({
    where: { userId: user.id },
    include: { reward: true },
    orderBy: { createdAt: 'desc' }
  })
}
