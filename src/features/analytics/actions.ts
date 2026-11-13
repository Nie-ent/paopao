"use server"

import { getCurrentUser } from "@/lib/current-user"
import { trackPageView } from "@/lib/feature-events"
import { DEMO_LINE_ID } from "@/lib/auth-user"

/** Records that the signed-in user opened a dashboard page (at most once per page per day). */
export async function recordPageView(path: string) {
  if (typeof path !== "string" || path.length > 200) return
  const user = await getCurrentUser()
  if (!user || user.lineId === DEMO_LINE_ID) return
  await trackPageView(path, user.id)
}
