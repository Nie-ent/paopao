import { describe, expect, it } from "vitest"
import { normalizeAmountText, parseAmountOnly } from "./amount-text"

describe("normalizeAmountText", () => {
  it("drops thousands separators", () => {
    expect(normalizeAmountText("ชำระหนี้ 1,000")).toBe("ชำระหนี้ 1000")
    expect(normalizeAmountText("เงินเดือน 35,000 บาท")).toBe("เงินเดือน 35000 บาท")
    expect(normalizeAmountText("ค่าบ้าน 1,250,000.50")).toBe("ค่าบ้าน 1250000.50")
    expect(normalizeAmountText("฿2,500")).toBe("฿2500")
  })
  it("keeps commas that separate items", () => {
    expect(normalizeAmountText("ข้าว 50, น้ำ 20")).toBe("ข้าว 50, น้ำ 20")
    expect(normalizeAmountText("ข้าว 50,น้ำ 20")).toBe("ข้าว 50,น้ำ 20")
  })
  it("reads Thai and full-width digits and k", () => {
    expect(normalizeAmountText("กาแฟ ๖๕")).toBe("กาแฟ 65")
    expect(normalizeAmountText("ค่าเช่า ๘,๕๐๐")).toBe("ค่าเช่า 8500")
    expect(normalizeAmountText("โบนัส 1.5k")).toBe("โบนัส 1500")
    expect(normalizeAmountText("ข้าวสาร 5kg 200")).toBe("ข้าวสาร 5kg 200")
  })
})

describe("parseAmountOnly", () => {
  it("accepts a bare amount", () => {
    expect(parseAmountOnly("1,250")).toBe(1250)
    expect(parseAmountOnly(" ฿80 ")).toBe(80)
    expect(parseAmountOnly("80 บาท")).toBe(80)
    expect(parseAmountOnly("๙๙.๕๐")).toBe(99.5)
  })
  it("rejects anything else", () => {
    for (const t of ["กาแฟ 65", "0", "-50", "1.234", "", "abc"]) expect(parseAmountOnly(t), t).toBeNull()
  })
})
