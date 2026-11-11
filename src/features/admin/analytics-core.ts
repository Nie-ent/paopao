/**
 * Pure calculations behind the admin analytics page (src/features/admin/analytics.ts loads the
 * rows). Days are Bangkok calendar days as "YYYY-MM-DD".
 */
import { bangkokDayKey } from "@/lib/dates"
import { PRO_PLANS, TRIAL_DAYS, isProActive, type ProPlan } from "@/lib/subscription"
import { REFERRAL_TRIAL_DAYS } from "@/lib/referral-rules"

const DAY_MS = 24 * 60 * 60 * 1000

/** Each Bangkok day key from `days - 1` days ago to today, oldest first. */
export function lastDays(days: number, now = new Date()) {
  return Array.from({ length: days }, (_, i) => bangkokDayKey(new Date(now.getTime() - (days - 1 - i) * DAY_MS)))
}

const dayIndex = (day: string) => Date.parse(`${day}T00:00:00Z`) / DAY_MS

export type EntrySource = "slip" | "statement" | "bill" | "typed"
export const ENTRY_SOURCE_LABELS: Record<EntrySource, string> = {
  typed: "พิมพ์ / เพิ่มเอง",
  slip: "สลิป",
  statement: "statement",
  bill: "บิลประจำ",
}

// ── Plan mix ────────────────────────────────────────────────────────────────

export type PlanSegment = "free" | "free_lapsed" | "paid" | "trial" | "invite_trial" | "referral_reward" | "other"

export const PLAN_SEGMENT_LABELS: Record<PlanSegment, string> = {
  paid: "Pro จ่ายเงิน",
  trial: `Pro ทดลอง ${TRIAL_DAYS} วัน`,
  invite_trial: `Pro เพื่อนที่ถูกชวน (${REFERRAL_TRIAL_DAYS} วัน)`,
  referral_reward: "Pro รางวัลผู้ชวน",
  other: "Pro อื่นๆ (แอดมินให้)",
  free_lapsed: "Free (เคยเป็น Pro)",
  free: "Free",
}

export type PlanUser = { subscriptionTier: string; proExpiresAt: Date | null; trialStartedAt: Date | null }
export type PlanPayment = { plan: string; createdAt: Date }

const planDays = (plan: string) => PRO_PLANS[plan as ProPlan]?.days ?? PRO_PLANS.MONTHLY.days

/**
 * Where a user's current plan comes from. Pro time stacks (a payment, a trial and referral rewards
 * all extend proExpiresAt), so the source is a best reading of the history:
 * a payment whose own period still covers now wins; otherwise the most recent trial or reward;
 * otherwise an older payment (its time was pushed back by stacking); otherwise an admin grant.
 */
export function planSegment(
  user: PlanUser,
  payments: PlanPayment[],
  history: { invited: boolean; rewardedAt: Date[] },
  now = new Date(),
): PlanSegment {
  if (!isProActive(user, now)) return user.proExpiresAt || user.trialStartedAt ? "free_lapsed" : "free"
  if (payments.some(p => p.createdAt.getTime() + planDays(p.plan) * DAY_MS > now.getTime())) return "paid"
  const lastReward = Math.max(0, ...history.rewardedAt.map(d => d.getTime()))
  const trial = user.trialStartedAt?.getTime() ?? 0
  if (lastReward || trial) {
    if (lastReward > trial) return "referral_reward"
    return history.invited ? "invite_trial" : "trial"
  }
  return payments.length > 0 ? "paid" : "other"
}

/**
 * Of the trials that have ended, how many paid afterwards. Invited friends get the longer trial.
 */
export function trialConversion(
  users: { trialStartedAt: Date | null; invited: boolean; payments: PlanPayment[] }[],
  now = new Date(),
) {
  let ended = 0, paid = 0
  for (const u of users) {
    if (!u.trialStartedAt) continue
    const end = u.trialStartedAt.getTime() + (u.invited ? REFERRAL_TRIAL_DAYS : TRIAL_DAYS) * DAY_MS
    if (end > now.getTime()) continue
    ended++
    if (u.payments.some(p => p.createdAt >= u.trialStartedAt!)) paid++
  }
  return { ended, paid, rate: ended ? paid / ended : null }
}

/**
 * Monthly recurring revenue implied by payments still in their period: a monthly payment counts in
 * full for 30 days, a yearly one as a twelfth for 365 days.
 */
export function mrr(payments: (PlanPayment & { amount: number })[], now = new Date()) {
  return payments.reduce((sum, p) => {
    const inPeriod = p.createdAt.getTime() + planDays(p.plan) * DAY_MS > now.getTime()
    if (!inPeriod) return sum
    return sum + (p.plan === "YEARLY" ? p.amount / 12 : p.amount)
  }, 0)
}

// ── Activity ────────────────────────────────────────────────────────────────

/** One row per user per Bangkok day they did something (logged an entry or used the AI). */
export type ActiveDay = { userId: string; day: string }

/** DAU per day plus WAU and MAU over the trailing 7 and 30 days ending that day. */
export function activeUserSeries(activity: ActiveDay[], days: string[]) {
  const usersByDay = new Map<number, Set<string>>()
  for (const a of activity) {
    const i = dayIndex(a.day)
    if (!usersByDay.has(i)) usersByDay.set(i, new Set())
    usersByDay.get(i)!.add(a.userId)
  }
  const distinctOver = (end: number, span: number) => {
    const seen = new Set<string>()
    for (let i = end - span + 1; i <= end; i++) usersByDay.get(i)?.forEach(u => seen.add(u))
    return seen.size
  }
  return days.map(day => {
    const i = dayIndex(day)
    return { day, dau: usersByDay.get(i)?.size ?? 0, wau: distinctOver(i, 7), mau: distinctOver(i, 30) }
  })
}

/** How many users were active on 1, 2–3, 4–7, 8–14 and 15+ of the days in `window` (inactive users left out). */
export function activeDaysHistogram(activity: ActiveDay[], window: string[]) {
  const inWindow = new Set(window)
  const daysPerUser = new Map<string, Set<string>>()
  for (const a of activity) {
    if (!inWindow.has(a.day)) continue
    if (!daysPerUser.has(a.userId)) daysPerUser.set(a.userId, new Set())
    daysPerUser.get(a.userId)!.add(a.day)
  }
  const buckets = [
    { label: "1 วัน", min: 1, max: 1 },
    { label: "2–3 วัน", min: 2, max: 3 },
    { label: "4–7 วัน", min: 4, max: 7 },
    { label: "8–14 วัน", min: 8, max: 14 },
    { label: "15+ วัน", min: 15, max: Infinity },
  ]
  const counts = buckets.map(b => ({ label: b.label, users: 0 }))
  for (const set of daysPerUser.values()) {
    const i = buckets.findIndex(b => set.size >= b.min && set.size <= b.max)
    counts[i].users++
  }
  return counts
}

/** Day number (days since epoch) of the Monday starting the Bangkok week of `day`. */
function weekStart(day: string) {
  const i = dayIndex(day)
  return i - (new Date(i * DAY_MS).getUTCDay() + 6) % 7
}
const dayFromIndex = (i: number) => new Date(i * DAY_MS).toISOString().slice(0, 10)

export type ProGrantSource = "paid" | "trial" | "invite_trial" | "referral_reward"

/**
 * New Pro time started per Bangkok week (Monday start), by source: a payment, a 14-day trial, an
 * invited friend's longer trial, or an inviter's reward. Oldest week first.
 */
export function proGrantsByWeek(
  events: { source: ProGrantSource; at: Date }[],
  { now = new Date(), weeks = 12 } = {},
) {
  const thisWeek = weekStart(bangkokDayKey(now))
  const rows = Array.from({ length: weeks }, (_, w) => ({
    week: dayFromIndex(thisWeek - (weeks - 1 - w) * 7), paid: 0, trial: 0, invite_trial: 0, referral_reward: 0,
  }))
  for (const e of events) {
    const w = (weekStart(bangkokDayKey(e.at)) - thisWeek) / 7 + weeks - 1
    if (w >= 0 && w < weeks) rows[w][e.source]++
  }
  return rows
}

/**
 * Weekly cohort retention: users grouped by the Bangkok week (Monday start) they signed up, and
 * for each week since, the share of the cohort active in it. Weeks that haven't started are null.
 */
export function weeklyRetention(
  users: { id: string; createdAt: Date }[],
  activity: ActiveDay[],
  { now = new Date(), cohorts = 8, weeks = 8 } = {},
) {
  const thisWeek = weekStart(bangkokDayKey(now))
  const firstCohort = thisWeek - (cohorts - 1) * 7

  const cohortOf = new Map<string, number>()
  for (const u of users) {
    const w = weekStart(bangkokDayKey(u.createdAt))
    if (w >= firstCohort) cohortOf.set(u.id, w)
  }
  const activeWeeks = new Map<string, Set<number>>()
  for (const a of activity) {
    if (!cohortOf.has(a.userId)) continue
    if (!activeWeeks.has(a.userId)) activeWeeks.set(a.userId, new Set())
    activeWeeks.get(a.userId)!.add(weekStart(a.day))
  }

  return Array.from({ length: cohorts }, (_, c) => {
    const start = firstCohort + c * 7
    const members = [...cohortOf].filter(([, w]) => w === start).map(([id]) => id)
    const rates = Array.from({ length: weeks }, (_, n) => {
      const week = start + n * 7
      if (week > thisWeek || members.length === 0) return null
      const active = members.filter(id => activeWeeks.get(id)?.has(week)).length
      return active / members.length
    })
    return { cohort: dayFromIndex(start), size: members.length, rates }
  })
}

/** Signup → first entry → active on 3+ days → started a trial → paid. */
export function funnel(stats: { users: number; withEntry: number; active3Days: number; trialStarted: number; paid: number }) {
  return [
    { stage: "สมัคร / เพิ่มเพื่อน", users: stats.users },
    { stage: "บันทึกรายการแรก", users: stats.withEntry },
    { stage: "ใช้งาน 3 วันขึ้นไป", users: stats.active3Days },
    { stage: "เริ่มทดลอง Pro", users: stats.trialStarted },
    { stage: "จ่ายเงิน", users: stats.paid },
  ]
}
