"use server"

import { getCurrentUser } from "@/lib/current-user"
import { cacheKeys, defaultTransactionQuery, type Locale } from "@/lib/cache-keys"
import { getBills } from "@/features/bills/actions"
import { getGoals } from "@/features/goals/actions"
import { getCategoryColors } from "@/features/settings/actions"
import { getSubscriptionData } from "@/features/subscription/actions"
import { getActiveQuests, getAvailableRewards, getUserClaims } from "@/features/quests/actions"
import { getDashboardData } from "@/features/dashboard/actions"
import { getTransactions } from "@/features/transactions/actions"
import { getReleaseNotes } from "@/features/releases/actions"
import { getReferralInfo } from "@/features/referral/actions"

/**
 * The first screen of every dashboard page, loaded in parallel in one request. Server Actions
 * run one at a time from the browser, so this replaces many sequential round trips with one.
 * Keys match src/lib/cache-keys.ts. A part that fails is left out; that page then loads it itself.
 */
export async function getAppSnapshot(input: { month: number; year: number; locale: Locale }) {
  const user = await getCurrentUser()
  if (!user) return {}

  const month = Number.isInteger(input?.month) && input.month >= 1 && input.month <= 12 ? input.month : new Date().getMonth() + 1
  const year = Number.isInteger(input?.year) && input.year >= 2000 && input.year <= 2100 ? input.year : new Date().getFullYear()
  const locale: Locale = input?.locale === "th-TH" ? "th-TH" : "en-US"
  const txQuery = defaultTransactionQuery(month, year)

  const parts: [string, () => Promise<unknown>][] = [
    [cacheKeys.bills, getBills],
    [cacheKeys.goals, getGoals],
    [cacheKeys.categoryColors, getCategoryColors],
    [cacheKeys.subscription, getSubscriptionData],
    [cacheKeys.quests, getActiveQuests],
    [cacheKeys.rewards, getAvailableRewards],
    [cacheKeys.claims, getUserClaims],
    [cacheKeys.releases, getReleaseNotes],
    [cacheKeys.referral, getReferralInfo],
    [cacheKeys.dashboard("MONTH", month, year, locale), () => getDashboardData("MONTH", month, year, locale)],
    [cacheKeys.transactions(txQuery), () => getTransactions(txQuery)],
  ]

  const results = await Promise.allSettled(parts.map(([, run]) => run()))
  const entries: Record<string, unknown> = { [cacheKeys.profile]: user }
  results.forEach((r, i) => {
    if (r.status === "fulfilled") entries[parts[i][0]] = r.value
    else console.error("[snapshot]", parts[i][0], r.reason)
  })
  return entries
}
