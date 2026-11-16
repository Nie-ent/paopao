"use server"

import prisma from "@/lib/db"
import { cookies } from "next/headers"
import { createHmac, timingSafeEqual } from "crypto"
import { clientIp, ADMIN_ATTEMPT_PREFIX } from "@/lib/client-ip"
import { isAdminAccount } from "@/lib/admin-access"
import { isProActive } from "@/lib/subscription"
import { getCurrentUser } from "@/lib/current-user"
import { logSecurityEvent } from "@/lib/security-log"

const ADMIN_COOKIE = "admin_session"

/** Cookie value derived from ADMIN_PASSWORD, so it can't be forged and rotates with the password. */
function adminSessionToken() {
  const password = process.env.ADMIN_PASSWORD
  if (!password) return null
  return createHmac("sha256", password).update("paopao-admin-session").digest("hex")
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

const ADMIN_LOGIN_LIMIT = { maxFailures: 5, windowMs: 15 * 60 * 1000 }

/** Records an admin change in the security log, with who made it (src/lib/security-events.ts) */
async function audit(detail: string) {
  const me = await getCurrentUser().catch(() => null)
  await logSecurityEvent("admin_action", { userId: me?.id ?? null, detail })
}

/** "Name (abcd1234)" for a user in audit lines */
async function who(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } }).catch(() => null)
  return `${u?.name ?? "?"} (${userId.slice(0, 8)})`
}

export async function loginAdmin(password: string) {
  const expected = process.env.ADMIN_PASSWORD
  const token = adminSessionToken()
  // Fails closed: with no ADMIN_PASSWORD configured, nobody can sign in
  if (!expected || !token) return { success: false, error: "รหัสผ่านไม่ถูกต้อง" }

  // Per-IP guessing limit, counted before the password is checked
  const ip = ADMIN_ATTEMPT_PREFIX + await clientIp()
  const failures = await prisma.loginAttempt.count({
    where: { ip, success: false, createdAt: { gt: new Date(Date.now() - ADMIN_LOGIN_LIMIT.windowMs) } }
  })
  if (failures >= ADMIN_LOGIN_LIMIT.maxFailures) {
    await logSecurityEvent("admin_login_blocked", { ip: ip.slice(ADMIN_ATTEMPT_PREFIX.length), detail: `ผิด ${failures} ครั้งใน 15 นาที` })
    return { success: false, error: "ลองผิดหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่" }
  }

  // Only listed LINE accounts may use the password at all (same answer either way, nothing to probe)
  const ok = typeof password === "string" && safeEqual(password, expected) && await isAdminAccount()
  await prisma.loginAttempt.create({ data: { ip, success: ok } })
  const me = await getCurrentUser().catch(() => null)
  await logSecurityEvent(ok ? "admin_login_ok" : "admin_login_failed", {
    ip: ip.slice(ADMIN_ATTEMPT_PREFIX.length), userId: me?.id ?? null,
    detail: ok ? null : `ผิดครั้งที่ ${failures + 1} จาก ${ADMIN_LOGIN_LIMIT.maxFailures} ใน 15 นาที`,
  })
  if (!ok) return { success: false, error: "รหัสผ่านไม่ถูกต้อง" }

  const cookieStore = await cookies()
  cookieStore.set(ADMIN_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 12 })
  return { success: true }
}

export async function logoutAdmin() {
  if (await isAdmin()) {
    const me = await getCurrentUser().catch(() => null)
    await logSecurityEvent("admin_logout", { userId: me?.id ?? null })
  }
  const cookieStore = await cookies()
  cookieStore.delete(ADMIN_COOKIE)
  return { success: true }
}

/** Both factors: a listed LINE account (src/lib/admin-access.ts) and the admin password cookie. */
export async function isAdmin() {
  if (!await isAdminAccount()) return false
  const cookieStore = await cookies()
  const token = adminSessionToken()
  const cookie = cookieStore.get(ADMIN_COOKIE)?.value
  return !!token && !!cookie && safeEqual(cookie, token)
}

export async function getAdminRewards() {
  if (!await isAdmin()) return []
  return prisma.reward.findMany({ orderBy: { createdAt: 'desc' } })
}

type RewardInput = { name: string, points: number, iconString: string, description: string, nameEn?: string, descriptionEn?: string }

/** Blank English fields are stored as null so the English UI falls back to the Thai text. */
function rewardData(data: RewardInput) {
  return { ...data, nameEn: data.nameEn?.trim() || null, descriptionEn: data.descriptionEn?.trim() || null }
}

export async function createReward(data: RewardInput) {
  if (!await isAdmin()) return { error: "Unauthorized" }
  await prisma.reward.create({ data: rewardData(data) })
  await audit(`สร้างของรางวัล "${data.name}" (${data.points} แต้ม)`)
  return { success: true }
}

export async function updateRewardStatus(id: string, status: string) {
  if (!await isAdmin()) return { error: "Unauthorized" }
  const r = await prisma.reward.update({ where: { id }, data: { status: status as any } })
  await audit(`เปลี่ยนสถานะของรางวัล "${r.name}" เป็น ${status}`)
  return { success: true }
}

export async function updateReward(id: string, data: RewardInput) {
  if (!await isAdmin()) return { error: "Unauthorized" }
  await prisma.reward.update({ where: { id }, data: rewardData(data) })
  await audit(`แก้ไขของรางวัล "${data.name}" (${data.points} แต้ม)`)
  return { success: true }
}

export async function deleteReward(id: string) {
  if (!await isAdmin()) return { error: "Unauthorized" }
  await prisma.rewardClaim.deleteMany({ where: { rewardId: id } }) // Cleanup claims referencing this reward
  const r = await prisma.reward.delete({ where: { id } })
  await audit(`ลบของรางวัล "${r.name}"`)
  return { success: true }
}

export async function getAdminClaims() {
  if (!await isAdmin()) return []
  return prisma.rewardClaim.findMany({
    include: { user: true, reward: true },
    orderBy: { createdAt: 'desc' }
  })
}

import { lineClient } from "@/config/line"

export async function updateClaimStatus(id: string, status: string) {
  if (!await isAdmin()) return { error: "Unauthorized" }
  
  const updated = await prisma.rewardClaim.update({ 
    where: { id }, 
    data: { status: status as any },
    include: { user: true, reward: true }
  })
  await audit(`การแลก "${updated.reward.name}" ของ ${updated.user.name ?? "?"} (${updated.userId.slice(0, 8)}) → ${status}`)

  if (status === 'SHIPPED' && updated.user.lineId && updated.user.lineId !== "demo") {
    try {
      await lineClient.pushMessage({
        to: updated.user.lineId,
        messages: [{
          type: "text",
          text: `🎉 ยินดีด้วย! ของรางวัล "${updated.reward.name}" ของคุณได้ถูกจัดส่งหรือพร้อมให้ใช้งานแล้วครับ! 🎁`
        }]
      })
    } catch (e) { console.error("Line webhook failed", e) }
  }

  return { success: true }
}

export async function getAdminQuests() {
  if (!await isAdmin()) return []
  return prisma.quest.findMany({ orderBy: { createdAt: 'desc' } })
}

export async function createQuest(data: { title: string, description: string, titleEn?: string, descriptionEn?: string, points: number, type: string, condition?: string }) {
  if (!await isAdmin()) return { error: "Unauthorized" }
  await audit(`สร้างภารกิจ "${data.title}" (${data.points} แต้ม)`)
  await prisma.quest.create({ data: { ...data, titleEn: data.titleEn?.trim() || null, descriptionEn: data.descriptionEn?.trim() || null, type: data.type as any, condition: (data.condition as any) || 'NONE', status: 'ACTIVE' } })
  return { success: true }
}

export async function updateQuestStatus(id: string, status: string) {
  if (!await isAdmin()) return { error: "Unauthorized" }
  const q = await prisma.quest.update({ where: { id }, data: { status: status as any } })
  await audit(`เปลี่ยนสถานะภารกิจ "${q.title}" เป็น ${status}`)
  return { success: true }
}

export async function updateQuest(id: string, data: { title: string, description: string, titleEn?: string, descriptionEn?: string, points: number, type: string, condition?: string }) {
  if (!await isAdmin()) return { error: "Unauthorized" }
  await audit(`แก้ไขภารกิจ "${data.title}" (${data.points} แต้ม)`)
  await prisma.quest.update({ where: { id }, data: { ...data, titleEn: data.titleEn?.trim() || null, descriptionEn: data.descriptionEn?.trim() || null, type: data.type as any, condition: data.condition as any } })
  return { success: true }
}

export async function deleteQuest(id: string) {
  if (!await isAdmin()) return { error: "Unauthorized" }
  await prisma.questClaim.deleteMany({ where: { questId: id } }) // Cleanup quest claims
  const q = await prisma.quest.delete({ where: { id } })
  await audit(`ลบภารกิจ "${q.title}"`)
  return { success: true }
}

/** Every account (newest first) with when they joined, their plan and how much they use PaoPao. */
export async function getAdminUsers() {
  if (!await isAdmin()) return []
  const [users, lastEntries, lastFeatures] = await Promise.all([
    prisma.user.findMany({
      where: { lineId: { notIn: ["demo", "demo_line_id", ""] } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, lineId: true, avatarUrl: true, paoPoints: true, createdAt: true,
        subscriptionTier: true, proExpiresAt: true, trialStartedAt: true,
        _count: { select: { transactions: true, subscriptionPayments: true } },
      },
    }),
    prisma.transaction.groupBy({ by: ['userId'], _max: { createdAt: true } }),
    prisma.featureEvent.groupBy({ by: ['userId'], _max: { createdAt: true }, where: { userId: { not: null } } }).catch(() => []),
  ])
  const last = new Map<string, Date>()
  for (const r of [...lastEntries, ...lastFeatures]) {
    const at = r._max.createdAt
    if (r.userId && at && (!last.get(r.userId) || at > last.get(r.userId)!)) last.set(r.userId, at)
  }
  const now = new Date()
  return users.map(u => ({
    id: u.id, name: u.name, lineId: u.lineId, avatarUrl: u.avatarUrl, paoPoints: u.paoPoints,
    createdAt: u.createdAt.toISOString(),
    lastActiveAt: last.get(u.id)?.toISOString() ?? null,
    entries: u._count.transactions,
    plan: isProActive(u, now) ? (u._count.subscriptionPayments > 0 ? "PRO_PAID" : "PRO_FREE") : u.proExpiresAt || u.trialStartedAt ? "FREE_LAPSED" : "FREE",
    proExpiresAt: u.proExpiresAt?.toISOString() ?? null,
  }))
}

export type AdminUser = Awaited<ReturnType<typeof getAdminUsers>>[number]

export async function adjustUserPoints(userId: string, pointsDelta: number) {
  if (!await isAdmin()) return { error: "Unauthorized" }
  
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return { error: "User not found" }
  
  // Prevent negative balance
  const newPoints = Math.max(0, (user.paoPoints || 0) + pointsDelta)
  
  await prisma.user.update({
    where: { id: userId },
    data: { paoPoints: newPoints }
  })
  await audit(`ปรับแต้ม ${user.name ?? "?"} (${userId.slice(0, 8)}) ${pointsDelta > 0 ? "+" : ""}${pointsDelta} → ${newPoints}`)
  return { success: true }
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Changes a user's plan from the admin page: add Pro days (on top of any Pro time left), set the
 * exact Pro end date, or end Pro now. Such Pro shows as "admin grant" in the stats when there is no
 * payment, trial or referral behind it.
 */
export async function adminSetPlan(userId: string, change: { action: "extend"; days: number } | { action: "until"; date: string } | { action: "free" }) {
  if (!await isAdmin()) return { error: "Unauthorized" }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, subscriptionTier: true, proExpiresAt: true } })
  if (!user) return { error: "User not found" }
  const now = new Date()

  if (change.action === "free") {
    await prisma.user.update({ where: { id: userId }, data: { subscriptionTier: "FREE", proExpiresAt: now } })
  } else if (change.action === "extend") {
    const days = Math.round(Number(change.days))
    if (!Number.isFinite(days) || days < 1 || days > 3660) return { error: "INVALID" }
    const from = isProActive(user, now) ? user.proExpiresAt! : now
    await prisma.user.update({ where: { id: userId }, data: { subscriptionTier: "PRO", proExpiresAt: new Date(from.getTime() + days * DAY_MS) } })
  } else {
    // A date from the picker means the end of that Bangkok day
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(change.date)
    if (!m) return { error: "INVALID" }
    const until = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + 1) - 7 * 60 * 60 * 1000 - 1)
    if (until <= now) return { error: "INVALID" }
    await prisma.user.update({ where: { id: userId }, data: { subscriptionTier: "PRO", proExpiresAt: until } })
  }
  console.info("[admin] plan changed", userId, change)
  await audit(`เปลี่ยนแพ็กเกจ ${await who(userId)}: ${change.action === "free" ? "เป็น Free" : change.action === "extend" ? `Pro +${change.days} วัน` : `Pro ถึง ${change.date}`}`)
  return { success: true }
}
