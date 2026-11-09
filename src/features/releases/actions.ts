"use server"

import prisma from "@/lib/db"
import { getCurrentUser } from "@/lib/current-user"
import { DEMO_LINE_ID } from "@/lib/auth-user"
import { RELEASES, unseenReleases } from "./notes"

/** Release notes the signed-in user hasn't dismissed yet (none for the shared demo account). */
export async function getReleaseNotes() {
  const user = await getCurrentUser()
  if (!user || user.lineId === DEMO_LINE_ID) return []
  return unseenReleases(user.lastSeenRelease, user.createdAt)
}

/** Dismisses the dialog: everything up to the newest release counts as seen. */
export async function markReleasesSeen() {
  const user = await getCurrentUser()
  if (!user || !RELEASES[0]) return { ok: false }
  // Never moves backwards (e.g. an old tab dismissing after a newer release)
  await prisma.user.updateMany({
    where: { id: user.id, OR: [{ lastSeenRelease: null }, { lastSeenRelease: { lt: RELEASES[0].id } }] },
    data: { lastSeenRelease: RELEASES[0].id },
  })
  return { ok: true }
}
