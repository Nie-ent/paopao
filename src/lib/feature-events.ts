/**
 * Which features people use: one row per use, for the admin page's "ฟีเจอร์" tab. Recording never
 * throws and never slows a feature down noticeably (one insert). Labels: src/lib/feature-catalog.ts.
 */
import prisma from "@/lib/db"
import type { FeatureKey } from "@/lib/feature-catalog"

export type FeatureSource = "line" | "web" | "group"

export async function trackFeature(feature: FeatureKey, opts: { source: FeatureSource; userId?: string | null; lineUserId?: string | null }) {
  try {
    await prisma.featureEvent.create({
      data: { feature, source: opts.source, userId: opts.userId ?? null, lineUserId: opts.userId ? null : opts.lineUserId ?? null },
    })
  } catch (error) {
    console.warn("[features] not recorded", feature, (error as Error)?.message ?? error)
  }
}

/** Web page views ("page:/bills"), one per user, page and Bangkok day at most. */
export async function trackPageView(path: string, userId: string, now = new Date()) {
  const page = normalizePage(path)
  if (!page) return
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  try {
    const seen = await prisma.featureEvent.findFirst({ where: { userId, feature: `page:${page}`, createdAt: { gte: since } }, select: { id: true } })
    if (!seen) await prisma.featureEvent.create({ data: { feature: `page:${page}`, source: "web", userId } })
  } catch (error) {
    console.warn("[features] page view not recorded", (error as Error)?.message ?? error)
  }
}

/** First path segment only ("/transactions?x=1" → "/transactions"); ids and queries are dropped. */
export function normalizePage(path: string) {
  const first = path.split(/[?#]/)[0].split("/").filter(Boolean)[0]
  if (!first) return "/"
  return /^[a-z-]{2,30}$/.test(first) ? `/${first}` : null
}
