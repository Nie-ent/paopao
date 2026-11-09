import { describe, expect, it } from "vitest"
import { lastWeekRange, trialReminderText, yesterdayRange } from "./brief"

// 07:00 Bangkok on Monday 9 Nov 2026 (when the cron runs)
const monday = new Date("2026-11-09T00:00:00Z")

describe("LINE summary ranges", () => {
  it("daily: all of yesterday in Bangkok", () => {
    const r = yesterdayRange(monday)
    expect(r.start.toISOString()).toBe("2026-11-07T17:00:00.000Z") // Sun 8 Nov 00:00 Bangkok
    expect(r.end.toISOString()).toBe("2026-11-08T17:00:00.000Z")
  })

  it("weekly: last Monday–Sunday, only on Mondays", () => {
    const r = lastWeekRange(monday)!
    expect(r.start.toISOString()).toBe("2026-11-01T17:00:00.000Z") // Mon 2 Nov 00:00 Bangkok
    expect(r.end.toISOString()).toBe("2026-11-08T17:00:00.000Z")
    expect(lastWeekRange(new Date("2026-11-10T00:00:00Z"))).toBeNull() // Tuesday
    expect(lastWeekRange(new Date("2026-11-08T16:59:00Z"))).toBeNull() // still Sunday in Bangkok
  })

  it("trial reminder states the end date and both prices", () => {
    const text = trialReminderText(new Date("2026-11-11T05:00:00Z"), "https://example.com/subscription")
    expect(text).toMatch(/11 พ\.ย\./)
    expect(text).toMatch(/฿59\/30 วัน/)
    expect(text).toMatch(/฿590/)
    expect(text).toContain("https://example.com/subscription")
  })
})
