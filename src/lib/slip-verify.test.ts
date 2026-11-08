import { afterEach, describe, expect, it, vi } from "vitest"
import { parseEasySlipResponse, proPlanFor, verifySlipImage } from "./slip-verify"

const verified = (amount: number, matched = true) => ({
  success: true,
  data: { matchedAccount: matched ? { nameTh: "ณภัทร" } : null, rawSlip: { transRef: "016262092532ABC", amount: { amount } } },
})

describe("parseEasySlipResponse", () => {
  it("reads reference, amount and whether the receiver is our account", () => {
    expect(parseEasySlipResponse(verified(59))).toEqual({ ok: true, transRef: "016262092532ABC", amount: 59, receiverMatched: true })
    expect(parseEasySlipResponse(verified(59, false))).toMatchObject({ ok: true, receiverMatched: false })
  })

  it("maps provider errors", () => {
    expect(parseEasySlipResponse({ success: false, error: { code: "SLIP_NOT_FOUND" } })).toEqual({ ok: false, reason: "NOT_A_SLIP" })
    expect(parseEasySlipResponse({ success: false, error: { code: "SLIP_PENDING" } })).toEqual({ ok: false, reason: "PENDING" })
    expect(parseEasySlipResponse({ success: false, error: { code: "QUOTA_EXCEEDED" } })).toEqual({ ok: false, reason: "UNAVAILABLE" })
  })

  it("treats a success without a reference as unusable", () => {
    expect(parseEasySlipResponse({ success: true, data: {} })).toEqual({ ok: false, reason: "UNAVAILABLE" })
  })
})

describe("proPlanFor", () => {
  it("needs our account and exactly a plan price", () => {
    expect(proPlanFor(parseEasySlipResponse(verified(59)))).toBe("MONTHLY")
    expect(proPlanFor(parseEasySlipResponse(verified(590)))).toBe("YEARLY")
    expect(proPlanFor(parseEasySlipResponse(verified(59, false)))).toBeNull()
    expect(proPlanFor(parseEasySlipResponse(verified(5900)))).toBeNull()
    expect(proPlanFor(parseEasySlipResponse(verified(58.99)))).toBeNull()
  })
})

describe("verifySlipImage", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("fails closed without an API key and never calls the provider", async () => {
    vi.stubEnv("EASYSLIP_API_KEY", "")
    const fetchImpl = vi.fn()
    expect(await verifySlipImage(Buffer.from("x"), "image/jpeg", fetchImpl)).toEqual({ ok: false, reason: "NOT_CONFIGURED" })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("sends the image with a Bearer key and asks EasySlip to match our account", async () => {
    vi.stubEnv("EASYSLIP_API_KEY", "k1")
    const fetchImpl = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify(verified(59))))
    const result = await verifySlipImage(Buffer.from("img"), "image/jpeg", fetchImpl as unknown as typeof fetch)
    expect(result).toMatchObject({ ok: true, amount: 59 })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe("https://api.easyslip.com/v2/verify/bank")
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer k1")
    const form = init?.body as FormData
    expect(form.get("matchAccount")).toBe("true")
    expect(form.get("image")).toBeInstanceOf(Blob)
  })

  it("reports a network failure as unavailable", async () => {
    vi.stubEnv("EASYSLIP_API_KEY", "k1")
    const fetchImpl = vi.fn(async () => { throw new Error("down") })
    expect(await verifySlipImage(Buffer.from("x"), "image/jpeg", fetchImpl as unknown as typeof fetch)).toEqual({ ok: false, reason: "UNAVAILABLE" })
  })
})
