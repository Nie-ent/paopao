import { bangkokDayKey } from "@/lib/dates"

type QuestWithClaims = { type: string; claims?: { createdAt: Date | string }[] }

/**
 * Whether the user has nothing left to claim on a quest: a one-time quest claimed once, or a daily
 * quest already claimed today (Bangkok). Claims are newest first (getActiveQuests).
 */
export function isQuestDone(q: QuestWithClaims, now = new Date()) {
  const last = q.claims?.[0]
  if (!last) return false
  if (q.type === "DAILY") return bangkokDayKey(new Date(last.createdAt)) === bangkokDayKey(now)
  return true
}

/** The quests the user can still claim; the dashboard hides the quest card when there are none. */
export function openQuests<T extends QuestWithClaims>(quests: T[], now = new Date()) {
  return quests.filter(q => !isQuestDone(q, now))
}
