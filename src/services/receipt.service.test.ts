import { describe, expect, it } from "vitest"
import { cleanReceipt, receiptLooksOff } from "./receipt.service"

describe("cleanReceipt", () => {
  it("rejects transfer slips and receipts with no usable items", () => {
    expect(cleanReceipt({ isReceipt: false, items: [{ name: "x", amount: 10 }] })).toBeNull()
    expect(cleanReceipt({ isReceipt: true, items: [{ name: "free water", amount: 0 }] })).toBeNull()
  })

  it("keeps sane items and positive extras", () => {
    const r = cleanReceipt({ isReceipt: true, merchant: " ร้านส้มตำ ", items: [{ name: "ส้มตำ", quantity: 2, amount: 120, discount: 20 }, { name: "", amount: 30.555 }], serviceCharge: 15, vat: 0, discount: -10, total: 155.56 })
    expect(r).toEqual({
      merchant: "ร้านส้มตำ",
      items: [{ name: "ส้มตำ", quantity: 2, amount: 120, discount: 20 }, { name: "รายการ", quantity: 1, amount: 30.56, discount: 0 }],
      serviceCharge: 15, vat: 0, discount: 10, printedTotal: 155.56,
    })
  })
})

describe("receiptLooksOff", () => {
  const item = (amount: number) => ({ name: "x", quantity: 1, amount, discount: 0 })
  it("accepts small gaps such as VAT on the service charge, and a missing total", () => {
    // Hama Sushi: 1,300 − 160 + 106.54 = 1,246.54 against 1,254.00 printed
    const sushi = { items: [item(1300)], serviceCharge: 106.54, vat: 0, discount: 160 }
    expect(receiptLooksOff({ ...sushi, printedTotal: 1254 })).toBe(false)
    expect(receiptLooksOff({ ...sushi, printedTotal: 0 })).toBe(false)
  })
  it("flags a total far from the items (a misread line)", () => {
    expect(receiptLooksOff({ items: [item(100), item(50)], serviceCharge: 0, vat: 0, discount: 0, printedTotal: 450 })).toBe(true)
  })
})
