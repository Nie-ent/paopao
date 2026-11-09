/**
 * When the LINE summary goes out (Pro). Every push counts against the LINE OA message quota
 * (docs/costs.md), so the default is a weekly summary on Monday mornings; users can switch to a
 * daily one or turn it off in Settings. Nothing is sent for a period without entries.
 */
import { bangkokDate, bangkokParts } from "@/lib/dates"
import { PRO_PLANS } from "@/lib/subscription"

export type BriefPeriod = "DAY" | "WEEK"
export type BriefRange = { period: BriefPeriod; start: Date; end: Date }

const DAY_MS = 24 * 60 * 60 * 1000

/** Yesterday (Bangkok), for daily summaries. */
export function yesterdayRange(now = new Date()): BriefRange {
  const { year, month, day } = bangkokParts(now)
  return { period: "DAY", start: bangkokDate(year, month, day - 1), end: bangkokDate(year, month, day) }
}

/** Last Monday–Sunday (Bangkok), only on Mondays: weekly summaries go out once a week. */
export function lastWeekRange(now = new Date()): BriefRange | null {
  const { year, month, day } = bangkokParts(now)
  const today = bangkokDate(year, month, day)
  // Weekday of the Bangkok date (0 = Sunday … 1 = Monday)
  if (new Date(today.getTime() + 7 * 60 * 60 * 1000).getUTCDay() !== 1) return null
  return { period: "WEEK", start: new Date(today.getTime() - 7 * DAY_MS), end: today }
}

/** Trials that end within this many days get one reminder. */
export const TRIAL_REMINDER_DAYS = 2

/** LINE message a couple of days before a free Pro trial ends. */
export function trialReminderText(expiresAt: Date, plansUrl: string) {
  const date = expiresAt.toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" })
  const { MONTHLY, YEARLY } = PRO_PLANS
  return `⏳ ทดลองใช้ Pro ฟรีจะหมดวันที่ ${date}\n` +
    `ใช้ต่อได้แค่ ฿${MONTHLY.priceThb}/${MONTHLY.days} วัน (ตกวันละไม่ถึง ฿${Math.ceil(MONTHLY.priceThb / MONTHLY.days)}) ` +
    `หรือรายปี ฿${YEARLY.priceThb} เฉลี่ยเดือนละ ฿${Math.round(YEARLY.priceThb / 12)}\n` +
    `จ่ายผ่านพร้อมเพย์ ไม่ตัดเงินอัตโนมัติ 👉 ${plansUrl}`
}
