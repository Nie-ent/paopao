"use server"

import prisma from "@/lib/db"
import { getProfileData } from "@/features/user/actions"
import { bangkokDayKey, startOfBangkokDay } from "@/lib/dates"
import { trackFeature } from "@/lib/feature-events"

/** Thrown inside a transaction to roll it back and return a user-facing error key. */
class ClaimError extends Error {}

/**
 * Locks the user's row for the rest of the transaction, so concurrent claims and redemptions by the
 * same user run one after another and each sees the previous one's result.
 */
async function lockUser(tx: Pick<typeof prisma, "$queryRaw">, userId: string) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
}

export async function claimDynamicQuest(questId: string) {
  const user = await getProfileData()
  if (!user) return { success: false, error: "Unauthorized" }

  const quest = await prisma.quest.findUnique({ where: { id: questId } })
  if (!quest || quest.status !== 'ACTIVE') return { success: false, error: "quest.error.inactive" }

  const today = bangkokDayKey(new Date())

  try {
    await prisma.$transaction(async (tx) => {
      await lockUser(tx, user.id)

      // Checked after the lock, so two simultaneous requests can't both pass
      const lastClaim = await tx.questClaim.findFirst({
        where: { userId: user.id, questId: quest.id },
        orderBy: { createdAt: 'desc' }
      })
      if (quest.type === 'ONETIME' && lastClaim) throw new ClaimError("quest.error.claimed_once")
      if (quest.type === 'DAILY' && lastClaim && bangkokDayKey(lastClaim.createdAt) === today) {
        throw new ClaimError("quest.error.claimed_today")
      }

      if (quest.condition === 'LOG_TRANSACTION_TODAY') {
        const loggedToday = await tx.transaction.findFirst({
          where: { userId: user.id, date: { gte: startOfBangkokDay() } },
          select: { date: true }
        })
        if (!loggedToday || bangkokDayKey(loggedToday.date) !== today) throw new ClaimError("quest.error.log_today")
      }

      await tx.user.update({
        where: { id: user.id },
        data: { paoPoints: { increment: quest.points } }
      })
      await tx.questClaim.create({
        data: { userId: user.id, questId: quest.id }
      })
    })
    await trackFeature("web_quest", { source: "web", userId: user.id })
    return { success: true }
  } catch (error) {
    if (error instanceof ClaimError) return { success: false, error: error.message }
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

  const reward = await prisma.reward.findUnique({ where: { id: rewardId } })
  if (!reward || reward.status !== 'AVAILABLE') {
    return { success: false, error: "rewards.error.unavailable" }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Only deducts when the balance covers the price, so concurrent redemptions can't overspend
      const { count } = await tx.user.updateMany({
        where: { id: user.id, paoPoints: { gte: reward.points } },
        data: { paoPoints: { decrement: reward.points } }
      })
      if (count === 0) throw new ClaimError("rewards.error.not_enough_points")

      await tx.rewardClaim.create({
        data: { userId: user.id, rewardId: reward.id, status: 'PENDING' }
      })
    })
    await trackFeature("web_reward", { source: "web", userId: user.id })
    return { success: true }
  } catch (error) {
    if (error instanceof ClaimError) return { success: false, error: error.message }
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
