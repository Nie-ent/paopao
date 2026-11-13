import { describe, expect, it } from "vitest"
import { cleanReceipt, receiptAddsUp } from "./receipt.service"

describe("cleanReceipt", () => {
  it("rejects transfer slips and receipts with no usable items", () => {
    expect(cleanReceipt({ isReceipt: false, items: [{ name: "x", amount: 10 }] })).toBeNull()
    expect(cleanReceipt({ isReceipt: true, items: [{ name: "free water", amount: 0 }] })).toBeNull()
  })

  it("keeps sane items and positive extras", () => {
    const r = cleanReceipt({ isReceipt: true, merchant: " ร้านส้มตำ ", items: [{ name: "ส้มตำ", quantity: 2, amount: 120 }, { name: "", amount: 30.555 }], serviceCharge: 15, vat: 0, discount: -10, total: 155.56 })
    expect(r).toEqual({
      merchant: "ร้านส้มตำ",
      items: [{ name: "ส้มตำ", quantity: 2, amount: 120 }, { name: "รายการ", quantity: 1, amount: 30.56 }],
      serviceCharge: 15, vat: 0, discount: 10, printedTotal: 155.56,
    })
  })
})

describe("receiptAddsUp", () => {
  const base = { items: [{ amount: 100 }, { amount: 50 }], serviceCharge: 15, vat: 0, discount: 0 }
  it("accepts a total within a baht, or no printed total", () => {
    expect(receiptAddsUp({ ...base, printedTotal: 165 })).toBe(true)
    expect(receiptAddsUp({ ...base, printedTotal: 0 })).toBe(true)
  })
  it("flags a total that doesn't match", () => {
    expect(receiptAddsUp({ ...base, printedTotal: 200 })).toBe(false)
  })
})
