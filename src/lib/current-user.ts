import prisma from "@/lib/db"
import { getUser } from "@/features/auth/actions"
import { resolveLineId } from "@/lib/auth-user"

/**
 * The signed-in user's database record (LINE session, demo or Supabase), or null when the
 * session is missing or doesn't map to a user. Server actions should start with this and
 * scope every query to `user.id`.
 */
export async function getCurrentUser() {
  const session = await getUser()
  const lineId = resolveLineId(session)
  if (!lineId) return null
  return prisma.user.findUnique({ where: { lineId } })
}
