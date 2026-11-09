import { describe, expect, it } from "vitest"
import { isQuestDone, openQuests } from "./quests"

// 10:00 on 9 Nov 2026 in Bangkok
const now = new Date("2026-11-09T03:00:00Z")

describe("quests", () => {
  it("a one-time quest is done once claimed", () => {
    expect(isQuestDone({ type: "ONETIME", claims: [] }, now)).toBe(false)
    expect(isQuestDone({ type: "ONETIME", claims: [{ createdAt: "2026-05-28T23:10:00Z" }] }, now)).toBe(true)
  })

  it("a daily quest is done only for the Bangkok day it was claimed", () => {
    // 06:30 Bangkok today
    expect(isQuestDone({ type: "DAILY", claims: [{ createdAt: "2026-11-08T23:30:00Z" }] }, now)).toBe(true)
    // 23:30 Bangkok yesterday
    expect(isQuestDone({ type: "DAILY", claims: [{ createdAt: "2026-11-08T16:30:00Z" }] }, now)).toBe(false)
  })

  it("leaves only what can still be claimed", () => {
    const qs = [
      { id: "a", type: "ONETIME", claims: [{ createdAt: now }] },
      { id: "b", type: "DAILY", claims: [] },
      { id: "c", type: "DAILY", claims: [{ createdAt: now }] },
    ]
    expect(openQuests(qs, now).map(q => q.id)).toEqual(["b"])
    expect(openQuests([qs[0], qs[2]], now)).toEqual([])
  })
})
