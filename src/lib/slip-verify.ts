/**
 * Checks a payment slip with the bank through EasySlip (https://document.easyslip.com/en/v2/),
 * instead of trusting what an AI reads from the image. This is the only file that knows the
 * provider; to switch provider, reimplement `verifySlipImage` with the same result type.
 *
 * Setup: create an API key in EasySlip, link the PromptPay account that receives Pro payments
 * to the branch (so `matchAccount` can match it), and set EASYSLIP_API_KEY.
 */
import { planForAmount, type ProPlan } from "@/lib/subscription"

const ENDPOINT = "https://api.easyslip.com/v2/verify/bank"

export type SlipVerification =
  | { ok: true; transRef: string; amount: number; receiverMatched: boolean }
  /** NOT_A_SLIP: no readable payment QR. PENDING: the bank hasn't published it yet. UNAVAILABLE: provider error or quota. */
  | { ok: false; reason: "NOT_CONFIGURED" | "NOT_A_SLIP" | "PENDING" | "UNAVAILABLE" }

type EasySlipResponse = {
  success?: boolean
  error?: { code?: string; message?: string }
  data?: {
    matchedAccount?: unknown
    amountInSlip?: number
    rawSlip?: { transRef?: string; amount?: { amount?: number } }
  }
}

export async function verifySlipImage(image: Buffer, mimeType = "image/jpeg", fetchImpl: typeof fetch = fetch): Promise<SlipVerification> {
  const apiKey = process.env.EASYSLIP_API_KEY
  if (!apiKey) return { ok: false, reason: "NOT_CONFIGURED" }

  const form = new FormData()
  form.append("image", new Blob([new Uint8Array(image)], { type: mimeType }), "slip.jpg")
  form.append("matchAccount", "true")
  // Replays are rejected by our own SubscriptionPayment table (unique bank reference), which is the source of truth

  let body: EasySlipResponse
  try {
    const res = await fetchImpl(ENDPOINT, { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form, signal: AbortSignal.timeout(20_000) })
    body = (await res.json()) as EasySlipResponse
  } catch (error) {
    console.error("Slip verification request failed:", error)
    return { ok: false, reason: "UNAVAILABLE" }
  }
  return parseEasySlipResponse(body)
}

/** Maps EasySlip's v2 response to our result. Exported for tests. */
export function parseEasySlipResponse(body: EasySlipResponse): SlipVerification {
  if (!body.success) {
    const code = body.error?.code
    if (code === "SLIP_NOT_FOUND") return { ok: false, reason: "NOT_A_SLIP" }
    if (code === "SLIP_PENDING") return { ok: false, reason: "PENDING" }
    console.error("Slip verification error:", code, body.error?.message)
    return { ok: false, reason: "UNAVAILABLE" }
  }
  const slip = body.data?.rawSlip
  const amount = Number(slip?.amount?.amount ?? body.data?.amountInSlip)
  if (!slip?.transRef || !Number.isFinite(amount)) return { ok: false, reason: "UNAVAILABLE" }
  return { ok: true, transRef: slip.transRef, amount, receiverMatched: !!body.data?.matchedAccount }
}

/**
 * The Pro plan a verified slip pays for: it must have gone to our account and be exactly a plan's
 * price (฿59 monthly or ฿590 yearly). Null otherwise.
 */
export function proPlanFor(v: SlipVerification): ProPlan | null {
  return v.ok && v.receiverMatched ? planForAmount(v.amount) : null
}
