"use server"

import prisma from "@/lib/db"
import { getCurrentUser } from "@/lib/current-user"
import { effectivePlan, isTrialEligible, LIMITS, PRO_PLANS, TRIAL_DAYS } from "@/lib/subscription"
import { startProTrial } from "@/lib/trial"

export async function getSubscriptionData() {
  const user = await getCurrentUser()
  if (!user) return null

  const plan = effectivePlan(user)
  const paidCount = await prisma.subscriptionPayment.count({ where: { userId: user.id } })
  return {
    plan,
    proExpiresAt: plan === "PRO" ? user.proExpiresAt?.toISOString() ?? null : null,
    /** Pro was active before but the period has ended */
    proExpired: plan === "FREE" && !!user.proExpiresAt,
    /** Currently on the free trial (never paid) */
    onTrial: plan === "PRO" && !!user.trialStartedAt && paidCount === 0,
    trialEligible: isTrialEligible(user, paidCount > 0),
    trialDays: TRIAL_DAYS,
    plans: PRO_PLANS,
    limits: {
      chatFree: LIMITS.chatPerDay.FREE,
      chatPro: LIMITS.chatPerDay.PRO,
      proSlipsPerMonth: LIMITS.proSlipsPerMonth,
      statementImportsPerDay: LIMITS.statementImportsPerDay.PRO,
      proRecurringBills: LIMITS.proRecurringBills,
    },
    slipsUsedThisMonth: user.aiSlipsUsed,
  }
}

/** Starts the one-time free Pro trial for the signed-in user. */
export async function startTrial() {
  const user = await getCurrentUser()
  if (!user) return { error: "Unauthorized" }
  const expiresAt = await startProTrial(user.id)
  return expiresAt ? { success: true, expiresAt: expiresAt.toISOString() } : { error: "NOT_ELIGIBLE" }
}
