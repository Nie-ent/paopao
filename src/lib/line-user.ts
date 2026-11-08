import prisma from "@/lib/db"
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session"

/** The user for a LINE account verified by LINE (LIFF or LINE Login), created on first sign-in, profile kept fresh. */
export async function upsertLineUser(profile: { userId: string; name: string | null; picture: string | null }) {
  const existing = await prisma.user.findUnique({ where: { lineId: profile.userId } })
  if (!existing) {
    return prisma.user.create({ data: { lineId: profile.userId, name: profile.name ?? "LINE User", avatarUrl: profile.picture ?? "" } })
  }
  const name = profile.name ?? existing.name
  const avatarUrl = profile.picture ?? existing.avatarUrl
  if (name === existing.name && avatarUrl === existing.avatarUrl) return existing
  return prisma.user.update({ where: { id: existing.id }, data: { name, avatarUrl } })
}

/**
 * Cookies that sign a user in: the signed session, plus the PDPA flag when they already accepted.
 * Returns null when sessions can't be signed (no secret configured), so callers fail closed.
 */
export async function signInCookies(user: { lineId: string; hasAcceptedPDPA: boolean }) {
  const token = await createSessionToken(user.lineId)
  if (!token) return null
  const cookies: { name: string; value: string; options: Record<string, unknown> }[] = [{ name: SESSION_COOKIE, value: token, options: sessionCookieOptions }]
  if (user.hasAcceptedPDPA) cookies.push({ name: "pdpa_accepted", value: "true", options: { maxAge: 60 * 60 * 24 * 30, path: "/" } })
  return cookies
}
