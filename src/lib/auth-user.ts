export const DEMO_LINE_ID = "demo"

type AuthUser = {
  id?: string
  app_metadata?: { provider?: string }
  user_metadata?: { provider_id?: string }
} | null | undefined

/**
 * Maps the session returned by getUser() to the lineId of the Prisma user.
 * Returns "" when the session can't be mapped, so lookups find no user
 * instead of falling back to someone else's account.
 */
export function resolveLineId(user: AuthUser): string {
  if (!user) return ""
  if (user.app_metadata?.provider === "line") return user.user_metadata?.provider_id || ""
  if (user.app_metadata?.provider === "demo") return DEMO_LINE_ID
  return ""
}
