import prisma from "@/lib/db"
import { bangkokDate, bangkokParts, startOfBangkokDay } from "@/lib/dates"

export type UsageKind = "statement_import" | "slip_verification"

/**
 * Records one use of a metered feature if the user is still under today's (Bangkok day) limit.
 * The user's row is locked while counting, so concurrent requests can't all slip under the limit.
 * Returns the recorded event's id, or null when the limit is already reached.
 */
export async function consumeDailyUsage(userId: string, kind: UsageKind, limit: number) {
  return consumeUsageSince(userId, kind, limit, startOfBangkokDay())
}

/** Like consumeDailyUsage, for a limit per Bangkok calendar month. */
export async function consumeMonthlyUsage(userId: string, kind: UsageKind, limit: number, now = new Date()) {
  const { year, month } = bangkokParts(now)
  return consumeUsageSince(userId, kind, limit, bangkokDate(year, month, 1))
}

async function consumeUsageSince(userId: string, kind: UsageKind, limit: number, since: Date) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
    const used = await tx.usageEvent.count({ where: { userId, kind, createdAt: { gte: since } } })
    if (used >= limit) return null
    return (await tx.usageEvent.create({ data: { userId, kind } })).id
  })
}

/** Gives a use back, e.g. when the request failed before doing any paid work. */
export async function refundUsage(eventId: string) {
  await prisma.usageEvent.delete({ where: { id: eventId } }).catch(() => {})
}
