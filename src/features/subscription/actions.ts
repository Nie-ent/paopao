"use server"

import prisma from "@/lib/db"
import { getCurrentUser } from "@/lib/current-user"
import { effectivePlan, isTrialEligible, LIMITS, PRO_PLANS, TRIAL_DAYS } from "@/lib/subscription"
import { startProTrial } from "@/lib/trial"
import { DEMO_LINE_ID } from "@/lib/auth-user"

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
    /** The shared demo account: it can look at plans, but upgrading needs the visitor's own LINE account */
    isDemo: user.lineId === DEMO_LINE_ID,
    /** Pro, or the shared demo: AI chat is a Pro feature */
    chatAllowed: plan === "PRO" || user.lineId === DEMO_LINE_ID,
    trialEligible: user.lineId !== DEMO_LINE_ID && isTrialEligible(user, paidCount > 0),
    trialDays: TRIAL_DAYS,
    plans: PRO_PLANS,
    limits: {
      chatPro: LIMITS.chatPerMonth.PRO,
      proSlipsPerMonth: LIMITS.proSlipsPerMonth,
      statementImportsPerMonth: LIMITS.statementImportsPerMonth.PRO,
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
