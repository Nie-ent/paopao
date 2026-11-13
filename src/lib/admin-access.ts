import { getUser } from "@/features/auth/actions"
import { resolveLineId } from "@/lib/auth-user"

/**
 * The admin area is for listed LINE accounts only (ADMIN_LINE_IDS, comma-separated LINE user ids),
 * on top of the admin password. Anyone else, signed in or not, gets a 404 at /admin, so the area
 * doesn't reveal that it exists. Empty or unset = nobody (fails closed).
 */
export function adminLineIds() {
  return (process.env.ADMIN_LINE_IDS ?? "").split(",").map(s => s.trim()).filter(Boolean)
}

/** True when the browser is signed in to PaoPao with a LINE account listed as admin. */
export async function isAdminAccount() {
  const lineId = resolveLineId(await getUser())
  return !!lineId && adminLineIds().includes(lineId)
}
