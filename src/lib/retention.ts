import prisma from "@/lib/db"

/** How long data that isn't needed any more is kept; the privacy policy (pdpa.s4.body) states these. */
export const RETENTION = {
  /** AI conversations with no new message for this long */
  chatDays: 90,
  /** Admin sign-in attempts (they hold IP addresses); rate limiting only looks at the last 15 minutes */
  loginAttemptDays: 30,
}

const DAY = 24 * 60 * 60 * 1000

/** Deletes expired data. Run daily by the digest cron; safe to run more often. */
export async function purgeExpiredData(now = new Date()) {
  const [chats, drafts, attempts] = await Promise.all([
    prisma.chatSession.deleteMany({ where: { updatedAt: { lt: new Date(now.getTime() - RETENTION.chatDays * DAY) } } }),
    prisma.pendingEntry.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - RETENTION.loginAttemptDays * DAY) } } }),
  ])
  return { chats: chats.count, drafts: drafts.count, loginAttempts: attempts.count }
}
