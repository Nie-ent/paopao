"use server"

import { getCurrentUser } from "@/lib/current-user"
import { ensureReferralCode, referralSummary } from "@/lib/referral"
import { siteUrl } from "@/lib/site"

/** The signed-in user's invite link and how their invited friends are doing (null for the demo). */
export async function getReferralInfo() {
  const user = await getCurrentUser()
  if (!user || ["demo", "demo_line_id", ""].includes(user.lineId)) return null
  const code = await ensureReferralCode(user.id)
  return { link: `${siteUrl()}/r/${code}`, ...(await referralSummary(user.id)) }
}
