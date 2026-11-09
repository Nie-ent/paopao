/**
 * Invite friends, get Pro free.
 *
 * - Every account has an invite link /r/<code>. Opening it stores the code in a cookie for 30 days.
 * - A brand-new account that signs in with that cookie becomes the inviter's referral, and gets a
 *   longer free Pro trial (REFERRAL_TRIAL_DAYS instead of the usual one).
 * - The referral counts once the friend has logged entries on QUALIFY_DAYS different days
 *   (Bangkok) within QUALIFY_WINDOW_DAYS of signing up. The daily cron (processReferrals) checks;
 *   the inviter then gets REWARD_DAYS of Pro, added after any Pro time they still have, and a LINE
 *   message. At most MAX_REWARDS rewards per inviter. Referrals that don't qualify in time expire.
 * - Not counted: the inviter themselves, the demo account, accounts that already existed (more
 *   than a day old or with entries) or that were already referred.
 */
import crypto from "node:crypto"
import prisma from "@/lib/db"
import { bangkokDayKey } from "@/lib/dates"
import { extendProExpiry } from "@/lib/subscription"
import { startProTrial } from "@/lib/trial"

import { MAX_REWARDS, QUALIFY_DAYS, QUALIFY_WINDOW_DAYS, REFERRAL_TRIAL_DAYS, REWARD_DAYS } from "@/lib/referral-rules"
export { MAX_REWARDS, QUALIFY_DAYS, QUALIFY_WINDOW_DAYS, REFERRAL_TRIAL_DAYS, REWARD_DAYS }

export const REFERRAL_COOKIE = "paopao_ref"
export const REFERRAL_COOKIE_MAX_AGE = 30 * 24 * 60 * 60
/** An account this young with no entries still counts as new (LINE's follow webhook may create it first) */
const NEW_ACCOUNT_MS = 24 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const DEMO_LINE_IDS = ["demo", "demo_line_id", ""]

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
export const isReferralCode = (s: unknown): s is string => typeof s === "string" && /^[A-HJ-NP-Z2-9]{8}$/.test(s)
const newCode = () => Array.from({ length: 8 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join("")

/** The user's invite code, created on first use. */
export async function ensureReferralCode(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { referralCode: true } })
  if (user.referralCode) return user.referralCode
  for (let i = 0; i < 5; i++) {
    const code = newCode()
    // Only sets it if still empty, so two tabs can't give the user two codes
    const { count } = await prisma.user.updateMany({ where: { id: userId, referralCode: null }, data: { referralCode: code } }).catch(() => ({ count: -1 }))
    if (count === 1) return code
    if (count === 0) return (await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { referralCode: true } })).referralCode!
    // count -1: the random code was taken (unique constraint); try another
  }
  throw new Error("Could not create a referral code")
}

/** Distinct Bangkok days among entry times, counted only inside the qualifying window. */
export function qualifyingDays(entryTimes: Date[], referredAt: Date) {
  const end = referredAt.getTime() + QUALIFY_WINDOW_DAYS * DAY_MS
  return new Set(entryTimes.filter(t => t.getTime() >= referredAt.getTime() && t.getTime() < end).map(t => bangkokDayKey(t))).size
}

type AttachResult = "ATTACHED" | "INVALID_CODE" | "SELF" | "NOT_NEW" | "ALREADY_REFERRED" | "DEMO"

/**
 * Called right after sign-in with the invite cookie: links a brand-new account to the inviter and
 * starts the friend's longer Pro trial. Safe to call for any user; it only acts on new accounts.
 */
export async function attachReferral(user: { id: string; lineId: string; createdAt: Date }, code: string | null | undefined, now = new Date()): Promise<AttachResult> {
  if (!isReferralCode(code)) return "INVALID_CODE"
  if (DEMO_LINE_IDS.includes(user.lineId)) return "DEMO"
  const referrer = await prisma.user.findUnique({ where: { referralCode: code }, select: { id: true, lineId: true } })
  if (!referrer || DEMO_LINE_IDS.includes(referrer.lineId)) return "INVALID_CODE"
  if (referrer.id === user.id) return "SELF"
  if (now.getTime() - user.createdAt.getTime() > NEW_ACCOUNT_MS) return "NOT_NEW"
  if (await prisma.transaction.count({ where: { userId: user.id } }) > 0) return "NOT_NEW"

  try {
    await prisma.referral.create({ data: { referrerId: referrer.id, refereeId: user.id, createdAt: now } })
  } catch {
    return "ALREADY_REFERRED" // refereeId is unique
  }
  await startProTrial(user.id, now, REFERRAL_TRIAL_DAYS).catch(e => console.error("[referral] trial", e))
  return "ATTACHED"
}

/**
 * Daily: qualifies referrals whose friend logged enough days, rewards the inviter (up to the
 * limit) and expires the ones past their window. Each referral is settled once.
 * Returns the inviters to notify on LINE.
 */
export async function processReferrals(now = new Date()) {
  const pending = await prisma.referral.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 500 })
  const rewarded: { lineId: string; expiresAt: Date; total: number }[] = []
  let qualified = 0, expired = 0

  for (const r of pending) {
    const end = new Date(r.createdAt.getTime() + QUALIFY_WINDOW_DAYS * DAY_MS)
    const entries = await prisma.transaction.findMany({ where: { userId: r.refereeId, createdAt: { gte: r.createdAt, lt: end } }, select: { createdAt: true } })
    if (qualifyingDays(entries.map(e => e.createdAt), r.createdAt) >= QUALIFY_DAYS) {
      const result = await prisma.$transaction(async tx => {
        // Locks the inviter so the limit holds even if two referrals settle at once
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${r.referrerId} FOR UPDATE`
        const { count } = await tx.referral.updateMany({ where: { id: r.id, status: "PENDING" }, data: { status: "QUALIFIED", qualifiedAt: now } })
        if (count === 0) return null // settled by another run
        const already = await tx.referral.count({ where: { referrerId: r.referrerId, rewardedAt: { not: null } } })
        if (already >= MAX_REWARDS) return null
        const inviter = await tx.user.findUniqueOrThrow({ where: { id: r.referrerId } })
        const expiresAt = extendProExpiry(inviter.subscriptionTier !== "FREE" ? inviter.proExpiresAt : null, now, REWARD_DAYS)
        await tx.user.update({ where: { id: inviter.id }, data: { subscriptionTier: "PRO", proExpiresAt: expiresAt } })
        await tx.referral.update({ where: { id: r.id }, data: { rewardedAt: now } })
        return { lineId: inviter.lineId, expiresAt, total: already + 1 }
      })
      qualified++
      if (result) rewarded.push(result)
    } else if (now >= end) {
      const { count } = await prisma.referral.updateMany({ where: { id: r.id, status: "PENDING" }, data: { status: "EXPIRED" } })
      expired += count
    }
  }
  return { checked: pending.length, qualified, expired, rewarded }
}

/** What the invite page shows. */
export async function referralSummary(userId: string) {
  const referrals = await prisma.referral.findMany({
    where: { referrerId: userId },
    orderBy: { createdAt: "desc" },
    include: { referee: { select: { name: true } } },
  })
  const rewardedCount = referrals.filter(r => r.rewardedAt).length
  const now = Date.now()
  return {
    rewardedCount,
    maxRewards: MAX_REWARDS,
    rewardDays: REWARD_DAYS,
    friendTrialDays: REFERRAL_TRIAL_DAYS,
    qualifyDays: QUALIFY_DAYS,
    qualifyWindowDays: QUALIFY_WINDOW_DAYS,
    friends: await Promise.all(referrals.map(async r => {
      const end = new Date(r.createdAt.getTime() + QUALIFY_WINDOW_DAYS * DAY_MS)
      const days = r.status === "PENDING"
        ? qualifyingDays((await prisma.transaction.findMany({ where: { userId: r.refereeId, createdAt: { gte: r.createdAt, lt: end } }, select: { createdAt: true } })).map(e => e.createdAt), r.createdAt)
        : null
      return {
        // First name only: enough to recognise a friend, no more
        name: (r.referee.name || "").trim().split(/\s+/)[0] || "LINE",
        status: r.status,
        rewarded: !!r.rewardedAt,
        daysLogged: days,
        daysLeft: r.status === "PENDING" ? Math.max(0, Math.ceil((end.getTime() - now) / DAY_MS)) : null,
      }
    })),
  }
}

/** LINE message to an inviter whose friend just qualified. */
export function referralRewardText(expiresAt: Date, total: number) {
  const date = expiresAt.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" })
  const left = MAX_REWARDS - total
  return `🎉 เพื่อนที่คุณชวนเริ่มจดรายรับรายจ่ายกับเป๋าเป๋าแล้ว! คุณได้ Pro ฟรี ${REWARD_DAYS} วัน ใช้ได้ถึง ${date}` +
    (left > 0 ? `\nชวนได้อีก ${left} คน รับ Pro เพิ่มคนละ ${REWARD_DAYS} วัน` : `\nคุณรับรางวัลชวนเพื่อนครบ ${MAX_REWARDS} ครั้งแล้ว ขอบคุณที่บอกต่อนะครับ 🙏`)
}
