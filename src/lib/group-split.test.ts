import { describe, expect, it } from "vitest"
import { debtsFor, debtsSettledBy, encodeGroupAction, isDebtsCommand, parseGroupAction, parseSplitCommand, splitBill } from "./group-split"

const none = { serviceCharge: 0, vat: 0, discount: 0 }
const sum = (m: Map<string, number>) => Math.round([...m.values()].reduce((s, v) => s + v, 0) * 100) / 100

const c = (...ids: string[]) => ids.map(userId => ({ userId, units: 1 }))

describe("splitBill", () => {
  it("shares each item between the people who ticked it", () => {
    const { shares, total } = splitBill([
      { id: "1", amount: 60, claims: c("a", "b") },
      { id: "2", amount: 120, claims: c("b") },
      { id: "3", amount: 20, claims: c("a") },
    ], none)
    expect(Object.fromEntries(shares)).toEqual({ a: 50, b: 150 })
    expect(total).toBe(200)
  })

  it("shares unticked items between everyone who took part", () => {
    const { shares, unclaimed } = splitBill([
      { id: "1", amount: 100, claims: c("a") },
      { id: "2", amount: 50, claims: [] },
    ], none)
    expect(unclaimed).toEqual(["2"])
    expect(Object.fromEntries(shares)).toEqual({ a: 150 })
  })

  it("adds service charge and VAT and takes off a discount in proportion, adding up exactly", () => {
    const items = [
      { id: "1", amount: 100, claims: c("a") },
      { id: "2", amount: 200, claims: c("b") },
      { id: "3", amount: 100, claims: c("a", "b", "c") },
    ]
    const { shares, total } = splitBill(items, { serviceCharge: 40, vat: 30.8, discount: 10 })
    expect(total).toBe(460.8)
    expect(sum(shares)).toBe(460.8)
    expect(shares.get("b")!).toBeGreaterThan(shares.get("a")!)
  })

  it("never loses a satang when an amount doesn't divide evenly", () => {
    const { shares } = splitBill([{ id: "1", amount: 100, claims: c("a", "b", "c") }], none)
    expect([...shares.values()].sort()).toEqual([33.33, 33.33, 33.34])
    expect(sum(shares)).toBe(100)
  })

  it("nobody owes anything before anyone ticks", () => {
    expect(splitBill([{ id: "1", amount: 100, claims: [] }], none).shares.size).toBe(0)
  })

  it("splits a multi-unit item by the units each person had", () => {
    const { shares } = splitBill([{ id: "1", amount: 570, quantity: 19, claims: [{ userId: "a", units: 7 }, { userId: "b", units: 12 }] }], none)
    expect(Object.fromEntries(shares)).toEqual({ a: 210, b: 360 })
  })

  it("shares units nobody took between everyone", () => {
    const { shares, leftover } = splitBill([
      { id: "1", amount: 100, quantity: 10, claims: [{ userId: "a", units: 6 }] },
      { id: "2", amount: 50, claims: c("b") },
    ], none)
    expect(leftover).toEqual([{ itemId: "1", units: 4 }])
    // a: 6 units (60) + half of the 4 left (20); b: 50 + 20
    expect(Object.fromEntries(shares)).toEqual({ a: 80, b: 70 })
  })

  it("gives an item's own discount only to the people who had it", () => {
    const { shares } = splitBill([
      { id: "1", amount: 200, discount: 50, claims: c("a") },
      { id: "2", amount: 100, claims: c("b") },
    ], none)
    expect(Object.fromEntries(shares)).toEqual({ a: 150, b: 100 })
  })

  it("adds up to the printed total when VAT is also charged on the service charge", () => {
    // Hama Sushi: items 1,300, discount 160 (VAT included) → 1,140; service 10% on the pre-VAT
    // amount 106.54, which also carries VAT; paid 1,254.00
    const items = [
      { id: "s40", amount: 360, quantity: 9, claims: [{ userId: "a", units: 4 }, { userId: "b", units: 5 }] },
      { id: "s60", amount: 60, claims: c("a") },
      { id: "s30", amount: 570, quantity: 19, claims: [{ userId: "a", units: 7 }, { userId: "b", units: 12 }] },
      { id: "side40", amount: 40, claims: c("b") },
      { id: "drink", amount: 50, claims: c("a") },
      { id: "side140", amount: 140, claims: c("a", "b") },
      { id: "s80", amount: 80, claims: c("b") },
    ]
    const result = splitBill(items, { serviceCharge: 106.54, vat: 0, discount: 160, printedTotal: 1254 })
    expect(result.total).toBe(1254)
    expect(sum(result.shares)).toBe(1254)
    expect(result.adjustment).toBeCloseTo(7.46)
    const withoutPrinted = splitBill(items, { serviceCharge: 106.54, vat: 0, discount: 160 })
    expect(withoutPrinted.total).toBe(1246.54)
  })
})

describe("debts", () => {
  it("everyone but the payer owes the payer", () => {
    expect(debtsFor(new Map([["a", 50], ["b", 150], ["c", 0]]), "b")).toEqual([{ debtorId: "a", amount: 50 }])
  })

  it("a slip settles one exact debt, or all of them when it matches the total", () => {
    const d1 = { id: "1", amount: 120, createdAt: new Date("2026-11-01") }
    const d2 = { id: "2", amount: 80, createdAt: new Date("2026-11-02") }
    expect(debtsSettledBy([d1, d2], 80)).toEqual([d2])
    expect(debtsSettledBy([d1, d2], 200)).toEqual([d1, d2])
    expect(debtsSettledBy([d1, d2], 100)).toEqual([])
  })
})

describe("commands and buttons", () => {
  it("parses split commands", () => {
    expect(parseSplitCommand("แยกบิล")).toEqual({ kind: "receipt" })
    expect(parseSplitCommand("แยกบิล 1,200 ค่าห้อง")).toEqual({ kind: "amount", amount: 1200, title: "ค่าห้อง" })
    expect(parseSplitCommand("หารบิล ฿450.50")).toEqual({ kind: "amount", amount: 450.5, title: "ค่าใช้จ่ายกลุ่ม" })
    expect(parseSplitCommand("แยกบิลกันไหม")).toBeNull()
    expect(parseSplitCommand("กินข้าวกัน")).toBeNull()
  })

  it("recognises the debts command only as the whole message", () => {
    expect(isDebtsCommand("ยอดค้าง")).toBe(true)
    expect(isDebtsCommand("ใครค้างบ้าง เดี๋ยวโอน")).toBe(false)
  })

  it("round-trips button data and rejects anything else", () => {
    const id = "123e4567-e89b-12d3-a456-426614174000"
    expect(parseGroupAction(encodeGroupAction({ kind: "paid", debtId: id }))).toEqual({ kind: "paid", debtId: id })
    expect(parseGroupAction(encodeGroupAction({ kind: "remind" }))).toEqual({ kind: "remind" })
    expect(parseGroupAction("g:paid:not-an-id")).toBeNull()
    expect(parseGroupAction("summary:WEEK")).toBeNull()
  })
})
