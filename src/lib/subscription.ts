/**
 * Plans, prices, limits and whether Pro is active. This is the single source of truth: the app,
 * the LINE bot, the pricing page, the structured data (JSON-LD) and llms.txt all read from here,
 * so what is advertised is what is enforced.
 *
 * Pro is paid ahead by PromptPay (no auto-renewal), so a user only counts as Pro while
 * `proExpiresAt` is in the future; `subscriptionTier` alone is not enough.
 */

export const PRO_PLANS = {
  MONTHLY: { priceThb: 59, days: 30 },
  /** About two months free compared with paying monthly */
  YEARLY: { priceThb: 590, days: 365 },
} as const
export type ProPlan = keyof typeof PRO_PLANS

/** One free Pro trial per account, started by the user */
export const TRIAL_DAYS = 14

/** Kept for callers that only need the monthly figures */
export const PRO_PRICE_THB = PRO_PLANS.MONTHLY.priceThb
export const PRO_PERIOD_DAYS = PRO_PLANS.MONTHLY.days

const DAY_MS = 24 * 60 * 60 * 1000

export const LIMITS = {
  /**
   * AI chat is a Pro feature (it is the largest AI cost: docs/costs.md). Messages per Bangkok
   * calendar month.
   */
  chatPerMonth: { PRO: 300 },
  /** The shared demo account resets daily, so its chat cap is per day and account-wide */
  demoChatPerDay: 30,
  /** Slip photos read by AI per month (Pro only; a fair-use cap that protects the AI budget) */
  proSlipsPerMonth: 300,
  /** Statement imports per Bangkok month for Pro (the AI reads the whole file, ≈ ฿1.3 each: docs/costs.md) */
  statementImportsPerMonth: { PRO: 20 },
  /** The shared demo account resets daily, so its statement imports are per day */
  demoStatementImportsPerDay: 10,
  /** Payment slips a Free user can submit for verification per Bangkok day (each one costs a check) */
  slipVerificationsPerDay: 5,
  /** Recurring bills PaoPao asks about on LINE (Pro) */
  proRecurringBills: 20,
} as const

type SubscriptionFields = { subscriptionTier: string; proExpiresAt: Date | null }

export function isProActive(user: SubscriptionFields, now = new Date()) {
  return user.subscriptionTier !== "FREE" && !!user.proExpiresAt && user.proExpiresAt > now
}

/** The plan whose limits apply right now. */
export function effectivePlan(user: SubscriptionFields, now = new Date()): "FREE" | "PRO" {
  return isProActive(user, now) ? "PRO" : "FREE"
}

/** New expiry after a payment or trial: `days` added to the current period, or from now if it already ended. */
export function extendProExpiry(currentExpiry: Date | null, now = new Date(), days: number = PRO_PERIOD_DAYS) {
  const from = currentExpiry && currentExpiry > now ? currentExpiry : now
  return new Date(from.getTime() + days * DAY_MS)
}

/** Which plan a transfer of this amount pays for, or null when it matches no plan exactly. */
export function planForAmount(amount: number): ProPlan | null {
  const match = (Object.keys(PRO_PLANS) as ProPlan[]).find(p => Math.abs(PRO_PLANS[p].priceThb - amount) < 0.005)
  return match ?? null
}

/** The trial is for accounts that never tried or paid for Pro. */
export function isTrialEligible(user: SubscriptionFields & { trialStartedAt: Date | null }, hasPaid: boolean, now = new Date()) {
  return !user.trialStartedAt && !hasPaid && !isProActive(user, now)
}
