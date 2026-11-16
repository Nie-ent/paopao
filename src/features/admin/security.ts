"use server"

import prisma from "@/lib/db"
import { Prisma } from "@prisma/client"
import { isAdmin } from "@/features/admin/actions"
import { fillTimeline, topSources, typesOf, type SecurityCategory, type Severity, type TimelineUnit } from "@/lib/security-events"

const HOUR = 60 * 60 * 1000
const RANGES = { "24h": 24 * HOUR, "7d": 7 * 24 * HOUR, "30d": 30 * 24 * HOUR, "90d": 90 * 24 * HOUR } as const
export type SecurityRange = keyof typeof RANGES
const PAGE = 50

export type SecurityFilter = { range: SecurityRange; severity?: Severity | null; category?: SecurityCategory | null; q?: string; cursor?: string | null }

/**
 * The admin security log (src/lib/security-events.ts): headline counts for the last 24 hours and
 * 7 days, the IPs behind the most suspicious events, and a filtered page of events, newest first.
 */
export async function getSecurityLog(filter: SecurityFilter) {
  if (!await isAdmin()) return null
  const now = Date.now()
  const since = new Date(now - (RANGES[filter.range] ?? RANGES["7d"]))
  const day = new Date(now - 24 * HOUR)
  const week = new Date(now - 7 * 24 * HOUR)

  const where: Prisma.SecurityEventWhereInput = { createdAt: { gte: since } }
  const types = filter.severity || filter.category ? typesOf({ severity: filter.severity, category: filter.category }) : null
  if (types) where.type = { in: types }
  // The chart: hourly for the last 24 hours, daily otherwise, in Bangkok time, same range and filters
  const unit: TimelineUnit = filter.range === "24h" ? "hour" : "day"
  const bucket = unit === "hour" ? "YYYY-MM-DD\"T\"HH24" : "YYYY-MM-DD"
  const q = filter.q?.trim()
  if (q) where.OR = [{ ip: { contains: q } }, { detail: { contains: q, mode: "insensitive" } }, { user: { name: { contains: q, mode: "insensitive" } } }]

  // Cursor = "<ISO time>|<id>" of the last row shown
  let cursorWhere: Prisma.SecurityEventWhereInput | null = null
  if (filter.cursor) {
    const [at, id] = filter.cursor.split("|")
    const t = new Date(at)
    if (!Number.isNaN(t.getTime()) && id) cursorWhere = { OR: [{ createdAt: { lt: t } }, { createdAt: t, id: { lt: id } }] }
  }

  const [rows, bySeverity24, byType7, recent7, timelineRows] = await Promise.all([
    prisma.securityEvent.findMany({
      where: cursorWhere ? { AND: [where, cursorWhere] } : where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PAGE + 1,
      include: { user: { select: { id: true, name: true } } },
    }),
    filter.cursor ? null : prisma.securityEvent.groupBy({ by: ["severity"], where: { createdAt: { gte: day } }, _count: { _all: true } }),
    filter.cursor ? null : prisma.securityEvent.groupBy({ by: ["type"], where: { createdAt: { gte: week } }, _count: { _all: true } }),
    filter.cursor ? null : prisma.securityEvent.findMany({ where: { createdAt: { gte: week }, severity: { not: "info" } }, select: { ip: true, severity: true, createdAt: true }, take: 5000, orderBy: { createdAt: "desc" } }),
    filter.cursor ? null : prisma.$queryRaw<{ key: string; severity: string; n: number }[]>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok', ${bucket}) AS key, severity, COUNT(*)::int AS n
      FROM "SecurityEvent"
      WHERE "createdAt" >= ${since} ${types ? Prisma.sql`AND type = ANY(${types})` : Prisma.empty}
      GROUP BY 1, 2`,
  ])

  const more = rows.length > PAGE
  const page = rows.slice(0, PAGE)
  const last = page[page.length - 1]
  const sev = (s: Severity) => bySeverity24?.find(r => r.severity === s)?._count._all ?? 0

  return {
    events: page.map(e => ({ id: e.id, type: e.type, severity: e.severity, ip: e.ip, detail: e.detail, createdAt: e.createdAt.toISOString(), user: e.user })),
    nextCursor: more && last ? `${last.createdAt.toISOString()}|${last.id}` : null,
    summary: filter.cursor ? null : {
      day: { critical: sev("critical"), warning: sev("warning"), info: sev("info") },
      week: Object.fromEntries((byType7 ?? []).map(r => [r.type, r._count._all])) as Record<string, number>,
      topSources: topSources(recent7 ?? []).map(s => ({ ...s, last: s.last.toISOString() })),
      timeline: { unit, points: fillTimeline(timelineRows ?? [], since, new Date(now), unit) },
    },
  }
}

export type SecurityLog = NonNullable<Awaited<ReturnType<typeof getSecurityLog>>>
