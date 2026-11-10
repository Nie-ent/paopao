"use server"

import { getCurrentUser } from "@/lib/current-user"
import { ensureReferralCode, referralSummary } from "@/lib/referral"
import { siteUrl } from "@/lib/site"
import { friendInviteMessage } from "@/lib/line-cards"

/** The signed-in user's invite link and how their invited friends are doing (null for the demo). */
export async function getReferralInfo() {
  const user = await getCurrentUser()
  if (!user || ["demo", "demo_line_id", ""].includes(user.lineId)) return null
  const code = await ensureReferralCode(user.id)
  const link = `${siteUrl()}/r/${code}`
  const summary = await referralSummary(user.id)
  // The card friends receive from the share page (built here so the client only passes it to LINE)
  const message = friendInviteMessage({ link, inviterName: user.name, friendTrialDays: summary.friendTrialDays })
  return { link, message, ...summary }
}
