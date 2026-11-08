import { describe, expect, it } from "vitest"
import { billReference, buildBillQuestion, encodeBillAnswer, isBillDue, parseBillAnswer } from "./bills"

const bill = (frequency: "DAILY" | "WEEKLY" | "MONTHLY", extra: { dayOfWeek?: number; dayOfMonth?: number } = {}) =>
  ({ frequency, dayOfWeek: extra.dayOfWeek ?? null, dayOfMonth: extra.dayOfMonth ?? null, active: true })

describe("isBillDue (Bangkok calendar)", () => {
  // 01:00 Bangkok, Monday 30 Nov 2026 = 18:00 UTC Sunday 29 Nov
  const mondayNight = new Date("2026-11-29T18:00:00Z")

  it("daily bills are always due, inactive ones never", () => {
    expect(isBillDue(bill("DAILY"), mondayNight)).toBe(true)
    expect(isBillDue({ ...bill("DAILY"), active: false }, mondayNight)).toBe(false)
  })

  it("weekly bills use the Bangkok weekday, not UTC", () => {
    expect(isBillDue(bill("WEEKLY", { dayOfWeek: 1 }), mondayNight)).toBe(true)
    expect(isBillDue(bill("WEEKLY", { dayOfWeek: 0 }), mondayNight)).toBe(false)
  })

  it("monthly bills use the Bangkok day of month", () => {
    expect(isBillDue(bill("MONTHLY", { dayOfMonth: 30 }), mondayNight)).toBe(true)
    expect(isBillDue(bill("MONTHLY", { dayOfMonth: 29 }), mondayNight)).toBe(false)
  })

  it("a day past the month's end falls on its last day", () => {
    const feb28 = new Date("2027-02-28T03:00:00Z")
    expect(isBillDue(bill("MONTHLY", { dayOfMonth: 31 }), feb28)).toBe(true)
    expect(isBillDue(bill("MONTHLY", { dayOfMonth: 31 }), new Date("2027-02-27T03:00:00Z"))).toBe(false)
  })
})

describe("bill answers", () => {
  it("round-trips through postback data", () => {
    const pay = { billId: "b1", day: "2026-11-30", kind: "pay" as const, amount: 850.5 }
    expect(parseBillAnswer(encodeBillAnswer(pay))).toEqual(pay)
    const other = { billId: "b1", day: "2026-11-30", kind: "other" as const }
    expect(parseBillAnswer(encodeBillAnswer(other))).toEqual(other)
  })

  it("rejects malformed or hostile data", () => {
    for (const d of ["", "bill", "bill|b1|today|pay|5", "bill|b1|2026-11-30|pay|-5", "bill|b1|2026-11-30|pay|abc", "goal|b1|2026-11-30|other", "bill|b1|2026-11-30|delete"]) {
      expect(parseBillAnswer(d)).toBeNull()
    }
  })

  it("reference is per bill per day", () => {
    expect(billReference("b1", "2026-11-30")).toBe("BILL-b1-2026-11-30")
  })
})

describe("buildBillQuestion", () => {
  const now = new Date("2026-11-29T18:00:00Z")
  it("one quick reply per bill, one-tap pay when the usual amount is known", () => {
    const msg = buildBillQuestion([{ id: "a", name: "ค่าไฟ", amount: 850 }, { id: "b", name: "ค่าเน็ต", amount: null }], now)
    const items = msg.quickReply?.items ?? []
    expect(items).toHaveLength(2)
    expect((items[0]?.action as { data: string }).data).toBe("bill|a|2026-11-30|pay|850")
    expect((items[1]?.action as { data: string }).data).toBe("bill|b|2026-11-30|other")
    expect(msg.type).toBe("flex")
    expect(msg.altText).toContain("ค่าไฟ")
    // The card's buttons carry the same postbacks as the quick replies
    expect(JSON.stringify(msg.contents)).toContain("bill|a|2026-11-30|pay|850")
  })

  it("respects LINE limits: 13 items, 20-char labels", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: String(i), name: "ค่าบริการรายเดือนแบบยาวมาก" + i, amount: 100 }))
    const msg = buildBillQuestion(many, now)
    const items = msg.quickReply?.items ?? []
    expect(items).toHaveLength(13)
    expect(items.every(i => (i.action?.label ?? "").length <= 20)).toBe(true)
  })
})
