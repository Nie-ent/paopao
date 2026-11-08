import prisma from "@/lib/db"
import { extendProExpiry, isTrialEligible, TRIAL_DAYS } from "@/lib/subscription"

/**
 * Starts the one-time free Pro trial. Returns the new expiry, or null when the account isn't
 * eligible (already trialled, has paid, or is Pro now). The user row is locked so a double tap
 * can't start two trials.
 */
export async function startProTrial(userId: string, now = new Date()) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } })
    const hasPaid = (await tx.subscriptionPayment.count({ where: { userId } })) > 0
    if (!isTrialEligible(user, hasPaid, now)) return null
    const proExpiresAt = extendProExpiry(null, now, TRIAL_DAYS)
    await tx.user.update({ where: { id: userId }, data: { subscriptionTier: "PRO", proExpiresAt, trialStartedAt: now } })
    return proExpiresAt
  })
}
