import { describe, expect, it } from "vitest"
import generatePayload from "promptpay-qr"
import { crc16, isPaymentQr, maskPromptPay, parseEmv, payQr, withAmount } from "./emv-qr"

describe("EMV payment QR", () => {
  const myQr = generatePayload("0812345678", {}) // a static "My QR" with no amount

  it("computes the EMVCo CRC", () => {
    expect(crc16("123456789")).toBe("29B1")
  })

  it("accepts a valid PromptPay code and rejects anything else", () => {
    expect(isPaymentQr(myQr)).toBe(true)
    expect(isPaymentQr("https://example.com")).toBe(false)
    expect(isPaymentQr(myQr.slice(0, -1) + (myQr.endsWith("0") ? "1" : "0"))).toBe(false) // CRC broken
  })

  it("puts an amount into a static code, matching what PromptPay itself would generate", () => {
    const priced = withAmount(myQr, 120.5)!
    expect(parseEmv(priced)?.find(f => f.id === "54")?.value).toBe("120.50")
    // Same fields as PromptPay's own amount code (field order may differ; only 00 first and 63 last are fixed)
    const fields = (p: string) => parseEmv(p)!.filter(f => f.id !== "63").sort((a, b) => a.id.localeCompare(b.id))
    expect(fields(priced)).toEqual(fields(generatePayload("0812345678", { amount: 120.5 })))
  })

  it("prefers the PromptPay number, falls back to the uploaded QR, and says when the amount isn't inside", () => {
    expect(payQr({ promptPayId: "0812345678", qrPayload: null }, 50)).toEqual({ payload: generatePayload("0812345678", { amount: 50 }), exact: true })
    expect(payQr({ promptPayId: null, qrPayload: myQr }, 50)).toEqual({ payload: withAmount(myQr, 50), exact: true })
    expect(payQr({ promptPayId: null, qrPayload: "some-other-qr" }, 50)).toEqual({ payload: "some-other-qr", exact: false })
    expect(payQr({ promptPayId: null, qrPayload: null }, 50)).toBeNull()
  })

  it("masks a PromptPay number", () => {
    expect(maskPromptPay("0812345678")).toBe("08xxxx5678")
  })
})
