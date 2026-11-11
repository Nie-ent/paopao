import prisma from "@/lib/db"
import { Prisma } from "@prisma/client"
import { bangkokDayKey } from "@/lib/dates"
import { USD_TO_THB, aiCostUsd } from "@/lib/ai-usage"
import { AI_FEATURE_LABELS, type AiFeature } from "@/lib/ai-features"
import { isAdmin } from "@/features/admin/actions"
import {
  activeDaysHistogram, activeUserSeries, funnel, lastDays, mrr, planSegment, proGrantsByWeek, trialConversion, weeklyRetention,
  PLAN_SEGMENT_LABELS, type ActiveDay, type EntrySource, type PlanSegment,
} from "@/features/admin/analytics-core"

/** Shared demo accounts are left out of every number (src/lib/referral.ts uses the same list). */
const DEMO_LINE_IDS = ["demo", "demo_line_id", ""]
const notDemo = Prisma.sql`"lineId" NOT IN (${Prisma.join(DEMO_LINE_IDS)})`

/** Bangkok calendar day of a UTC timestamp column, as "YYYY-MM-DD". */
const bkkDay = (column: Prisma.Sql) => Prisma.sql`to_char(${column} + interval '7 hours', 'YYYY-MM-DD')`

const SERIES_DAYS = 90
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Everything the admin analytics page shows, computed on request (the user base is small; each
 * query is one aggregate). Returns null for non-admins.
 */
export async function getAdminAnalytics(now = new Date()) {
  if (!await isAdmin()) return null

  const days = lastDays(SERIES_DAYS, now)
  const since = new Date(now.getTime() - (SERIES_DAYS + 7) * DAY_MS)
  const last30 = new Set(lastDays(30, now))

  const [users, payments, referrals, activity, entryRows, entryTotals, usageEvents] = await Promise.all([
    prisma.user.findMany({
      where: { lineId: { notIn: DEMO_LINE_IDS } },
      select: { id: true, name: true, createdAt: true, subscriptionTier: true, proExpiresAt: true, trialStartedAt: true },
    }),
    prisma.subscriptionPayment.findMany({
      where: { user: { lineId: { notIn: DEMO_LINE_IDS } } },
      select: { userId: true, amount: true, plan: true, createdAt: true },
    }),
    prisma.referral.findMany({ select: { referrerId: true, refereeId: true, status: true, rewardedAt: true } }),
    // A user counts as active on a day they logged an entry (AI use is merged in below)
    prisma.$queryRaw<ActiveDay[]>`
      SELECT DISTINCT t."userId", ${bkkDay(Prisma.sql`t."createdAt"`)} AS day
      FROM "Transaction" t JOIN "User" u ON u.id = t."userId"
      WHERE t."createdAt" >= ${since} AND u.${notDemo}`,
    prisma.$queryRaw<{ day: string; source: EntrySource; n: number }[]>`
      SELECT ${bkkDay(Prisma.sql`t."createdAt"`)} AS day,
        CASE WHEN t."slipHash" IS NOT NULL THEN 'slip'
             WHEN t."reference" LIKE 'BILL-%' THEN 'bill'
             WHEN t."reference" IS NOT NULL THEN 'statement'
             ELSE 'typed' END AS source,
        COUNT(*)::int AS n
      FROM "Transaction" t JOIN "User" u ON u.id = t."userId"
      WHERE t."createdAt" >= ${since} AND u.${notDemo}
      GROUP BY 1, 2`,
    // Per user, all time: entries and distinct active days (for the funnel)
    prisma.$queryRaw<{ userId: string; entries: number; activeDays: number }[]>`
      SELECT t."userId", COUNT(*)::int AS entries, COUNT(DISTINCT ${bkkDay(Prisma.sql`t."createdAt"`)})::int AS "activeDays"
      FROM "Transaction" t JOIN "User" u ON u.id = t."userId"
      WHERE u.${notDemo}
      GROUP BY 1`,
    prisma.usageEvent.groupBy({
      by: ["kind"],
      where: { createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS) }, user: { lineId: { notIn: DEMO_LINE_IDS } } },
      _count: { _all: true },
    }),
  ])

  const ai = await loadAiUsage(since, now)
  const allActivity = dedupeActivity([...activity, ...ai.activity])
  const userIds = new Set(users.map(u => u.id))

  // ── Plans ──
  const paymentsByUser = groupBy(payments, p => p.userId)
  const invited = new Set(referrals.map(r => r.refereeId))
  const rewardsByUser = groupBy(referrals.filter(r => r.rewardedAt), r => r.referrerId)
  const segmentOf = new Map<string, PlanSegment>()
  for (const u of users) {
    segmentOf.set(u.id, planSegment(u, paymentsByUser.get(u.id) ?? [], {
      invited: invited.has(u.id),
      rewardedAt: (rewardsByUser.get(u.id) ?? []).map(r => r.rewardedAt!),
    }, now))
  }
  const planMix = (Object.keys(PLAN_SEGMENT_LABELS) as PlanSegment[]).map(segment => ({
    segment, label: PLAN_SEGMENT_LABELS[segment], users: [...segmentOf.values()].filter(s => s === segment).length,
  }))
  const proNow = planMix.filter(p => !p.segment.startsWith("free")).reduce((s, p) => s + p.users, 0)

  // ── Users and activity ──
  const newPerDay = countBy(users, u => bangkokDayKey(u.createdAt))
  let cumulative = users.filter(u => bangkokDayKey(u.createdAt) < days[0]).length
  const growth = days.map(day => {
    const added = newPerDay.get(day) ?? 0
    cumulative += added
    return { day, newUsers: added, totalUsers: cumulative }
  })
  const active = activeUserSeries(allActivity, days)
  const today = active[active.length - 1]

  const totals = new Map(entryTotals.map(e => [e.userId, e]))
  const entries30 = entryRows.filter(r => last30.has(r.day)).reduce((s, r) => s + r.n, 0)

  // ── Entries by source ──
  const entriesByDay = new Map(days.map(day => [day, { day, typed: 0, slip: 0, statement: 0, bill: 0 }]))
  for (const r of entryRows) {
    const row = entriesByDay.get(r.day)
    if (row) row[r.source] += r.n
  }

  // ── Revenue ──
  const revenueByMonth = new Map<string, { month: string; MONTHLY: number; YEARLY: number }>()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getTime() + 7 * 60 * 60 * 1000)
    d.setUTCDate(1)
    d.setUTCMonth(d.getUTCMonth() - i)
    const month = d.toISOString().slice(0, 7)
    revenueByMonth.set(month, { month, MONTHLY: 0, YEARLY: 0 })
  }
  for (const p of payments) {
    const row = revenueByMonth.get(bangkokDayKey(p.createdAt).slice(0, 7))
    if (row) row[p.plan === "YEARLY" ? "YEARLY" : "MONTHLY"] += p.amount
  }
  const trials = users.map(u => ({ trialStartedAt: u.trialStartedAt, invited: invited.has(u.id), payments: paymentsByUser.get(u.id) ?? [] }))
  const conversion = trialConversion(trials, now)
  // The 14-day trial and an invited friend's longer trial convert differently, so each is shown on its own
  const conversionTrial = trialConversion(trials.filter(t => !t.invited), now)
  const conversionInvite = trialConversion(trials.filter(t => t.invited), now)
  const grants = proGrantsByWeek([
    ...payments.map(p => ({ source: "paid" as const, at: p.createdAt })),
    ...users.filter(u => u.trialStartedAt).map(u => ({ source: invited.has(u.id) ? "invite_trial" as const : "trial" as const, at: u.trialStartedAt! })),
    ...referrals.filter(r => r.rewardedAt && userIds.has(r.referrerId)).map(r => ({ source: "referral_reward" as const, at: r.rewardedAt! })),
  ], { now })

  // ── Referrals ──
  const realReferrals = referrals.filter(r => userIds.has(r.refereeId))
  const referralStats = {
    total: realReferrals.length,
    pending: realReferrals.filter(r => r.status === "PENDING").length,
    qualified: realReferrals.filter(r => r.status === "QUALIFIED").length,
    expired: realReferrals.filter(r => r.status === "EXPIRED").length,
    rewarded: realReferrals.filter(r => r.rewardedAt).length,
  }

  // ── AI by plan and top users ──
  const aiByPlan = new Map<string, { label: string; costThb: number; users: Set<string> }>()
  for (const r of ai.byUser) {
    const segment = r.userId ? segmentOf.get(r.userId) : undefined
    const key = segment ? (segment.startsWith("free") ? "Free" : "Pro") : "ไม่ระบุผู้ใช้"
    if (!aiByPlan.has(key)) aiByPlan.set(key, { label: key, costThb: 0, users: new Set() })
    const row = aiByPlan.get(key)!
    row.costThb += r.costThb
    if (r.userId) row.users.add(r.userId)
  }
  const names = new Map(users.map(u => [u.id, u.name]))
  const topAiUsers = [...ai.byUser]
    .filter(r => r.userId && userIds.has(r.userId))
    .sort((a, b) => b.costThb - a.costThb)
    .slice(0, 10)
    .map(r => ({ ...r, name: names.get(r.userId!) || "LINE User", plan: PLAN_SEGMENT_LABELS[segmentOf.get(r.userId!) ?? "free"] }))

  const mau = today?.mau ?? 0
  return {
    asOf: now.toISOString(),
    kpis: {
      totalUsers: users.length,
      new7d: users.filter(u => now.getTime() - u.createdAt.getTime() < 7 * DAY_MS).length,
      new30d: users.filter(u => now.getTime() - u.createdAt.getTime() < 30 * DAY_MS).length,
      dau: today?.dau ?? 0,
      wau: today?.wau ?? 0,
      mau,
      stickiness: mau ? (today?.dau ?? 0) / mau : null,
      entries30d: entries30,
      entriesPerActiveUser: mau ? entries30 / mau : null,
      proNow,
      payingNow: planMix.find(p => p.segment === "paid")?.users ?? 0,
      mrrThb: mrr(payments, now),
      revenueTotalThb: payments.reduce((s, p) => s + p.amount, 0),
      payingUsersEver: paymentsByUser.size,
      trialConversion: conversion,
      trialConversion14: conversionTrial,
      trialConversionInvite: conversionInvite,
      aiCost30dThb: ai.cost30dThb,
      aiCostPerMauThb: mau && ai.available ? ai.cost30dThb / mau : null,
      statementImports30d: usageEvents.find(e => e.kind === "statement_import")?._count._all ?? 0,
      slipVerifications30d: usageEvents.find(e => e.kind === "slip_verification")?._count._all ?? 0,
    },
    growth,
    active,
    activeDays: activeDaysHistogram(allActivity, [...last30]),
    retention: weeklyRetention(users, allActivity, { now }),
    funnel: funnel({
      users: users.length,
      withEntry: [...totals.values()].filter(t => userIds.has(t.userId) && t.entries > 0).length,
      active3Days: [...totals.values()].filter(t => userIds.has(t.userId) && t.activeDays >= 3).length,
      trialStarted: users.filter(u => u.trialStartedAt).length,
      paid: paymentsByUser.size,
    }),
    planMix,
    entriesBySource: [...entriesByDay.values()],
    revenue: [...revenueByMonth.values()],
    proGrants: grants,
    referrals: referralStats,
    ai: {
      available: ai.available,
      since: ai.firstAt,
      byDay: ai.byDay,
      byFeature: ai.byFeature,
      byPlan: [...aiByPlan.values()].map(r => ({ label: r.label, costThb: r.costThb, users: r.users.size, perUserThb: r.users.size ? r.costThb / r.users.size : null })),
      topUsers: topAiUsers,
    },
  }
}

export type AdminAnalytics = NonNullable<Awaited<ReturnType<typeof getAdminAnalytics>>>

/**
 * AI token usage (src/lib/ai-usage.ts). The table is new: if its migration hasn't run yet the page
 * still loads and says so.
 */
async function loadAiUsage(since: Date, now: Date) {
  const empty = { available: false, firstAt: null as string | null, activity: [] as ActiveDay[], byDay: [] as Record<string, number | string>[], byFeature: [] as AiFeatureRow[], byUser: [] as AiUserRow[], cost30dThb: 0 }
  try {
    const [rows, first] = await Promise.all([
      prisma.$queryRaw<{ day: string; userId: string | null; feature: string; model: string; calls: number; input: number; output: number }[]>`
        SELECT ${bkkDay(Prisma.sql`a."createdAt"`)} AS day, a."userId", a.feature, a.model,
          COUNT(*)::int AS calls, SUM(a."inputTokens")::int AS input, SUM(a."outputTokens")::int AS output
        FROM "AiUsage" a LEFT JOIN "User" u ON u.id = a."userId"
        WHERE a."createdAt" >= ${since} AND (u.id IS NULL OR u.${notDemo})
        GROUP BY 1, 2, 3, 4`,
      prisma.aiUsage.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    ])
    const days = lastDays(SERIES_DAYS, now)
    const last30 = new Set(lastDays(30, now))
    const features = Object.keys(AI_FEATURE_LABELS) as AiFeature[]
    const byDay = new Map(days.map(day => [day, Object.fromEntries([["day", day], ...features.map(f => [f, 0]), ["other", 0]]) as Record<string, number | string>]))
    const byFeature = new Map<string, AiFeatureRow>()
    const byUser = new Map<string, AiUserRow>()
    let cost30 = 0

    for (const r of rows) {
      const costThb = aiCostUsd(r.model, new Date(`${r.day}T12:00:00+07:00`), r.input, r.output) * USD_TO_THB
      const feature = r.feature in AI_FEATURE_LABELS ? r.feature : "other"
      const day = byDay.get(r.day)
      if (day) day[feature] = (day[feature] as number) + costThb
      if (!last30.has(r.day)) continue
      cost30 += costThb
      const f = byFeature.get(feature) ?? { feature, label: AI_FEATURE_LABELS[feature as AiFeature] ?? "อื่นๆ", calls: 0, inputTokens: 0, outputTokens: 0, costThb: 0 }
      f.calls += r.calls; f.inputTokens += r.input; f.outputTokens += r.output; f.costThb += costThb
      byFeature.set(feature, f)
      const key = r.userId ?? ""
      const u = byUser.get(key) ?? { userId: r.userId, calls: 0, tokens: 0, costThb: 0 }
      u.calls += r.calls; u.tokens += r.input + r.output; u.costThb += costThb
      byUser.set(key, u)
    }
    return {
      available: true,
      firstAt: first?.createdAt.toISOString() ?? null,
      activity: rows.filter(r => r.userId).map(r => ({ userId: r.userId!, day: r.day })),
      byDay: [...byDay.values()],
      byFeature: [...byFeature.values()].sort((a, b) => b.costThb - a.costThb),
      byUser: [...byUser.values()],
      cost30dThb: cost30,
    }
  } catch (error) {
    console.warn("[admin] AI usage unavailable (has the AiUsage migration run?)", (error as Error)?.message)
    return empty
  }
}

type AiFeatureRow = { feature: string; label: string; calls: number; inputTokens: number; outputTokens: number; costThb: number }
type AiUserRow = { userId: string | null; calls: number; tokens: number; costThb: number }

function dedupeActivity(rows: ActiveDay[]) {
  const seen = new Map<string, ActiveDay>()
  for (const r of rows) seen.set(`${r.userId}|${r.day}`, r)
  return [...seen.values()]
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const k = key(item)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(item)
  }
  return map
}

function countBy<T>(items: T[], key: (item: T) => string) {
  const map = new Map<string, number>()
  for (const item of items) map.set(key(item), (map.get(key(item)) ?? 0) + 1)
  return map
}
