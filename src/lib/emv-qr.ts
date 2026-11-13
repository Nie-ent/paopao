/**
 * Thai QR payment codes (EMVCo merchant-presented QR, which PromptPay and the banks' "My QR" use).
 * A payload is a list of tag-length-value fields ending in a CRC. To ask a friend for an exact
 * amount we set the amount field (54), mark the code as single-use (01 = "12") and recompute the CRC,
 * so the banking app opens with the amount filled in.
 * Spec: EMVCo QR Code Specification for Payment Systems, Merchant-Presented Mode.
 */
import generatePayload from "promptpay-qr"

type Field = { id: string; value: string }

/** CRC-16/CCITT-FALSE, as EMVCo requires (poly 0x1021, start 0xFFFF), in 4 upper-case hex digits. */
export function crc16(data: string) {
  let crc = 0xffff
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, "0")
}

/** The top-level fields, or null when the text isn't a well-formed EMV payload with a valid CRC. */
export function parseEmv(payload: string): Field[] | null {
  if (!/^000201/.test(payload) || payload.length < 20 || payload.length > 512) return null
  const fields: Field[] = []
  let i = 0
  while (i < payload.length) {
    const id = payload.slice(i, i + 2)
    const len = Number(payload.slice(i + 2, i + 4))
    if (!/^\d{2}$/.test(id) || !Number.isInteger(len) || i + 4 + len > payload.length) return null
    fields.push({ id, value: payload.slice(i + 4, i + 4 + len) })
    i += 4 + len
  }
  const crc = fields.at(-1)
  if (crc?.id !== "63" || crc.value.length !== 4) return null
  if (crc16(payload.slice(0, -4)).toUpperCase() !== crc.value.toUpperCase()) return null
  return fields
}

const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`

/** The same payment code asking for `amount` baht. Null when the payload isn't a valid EMV code. */
export function withAmount(payload: string, amount: number): string | null {
  const fields = parseEmv(payload)
  if (!fields || !(amount > 0)) return null
  const kept = fields.filter(f => !["01", "54", "63"].includes(f.id))
  const all = [...kept, { id: "01", value: "12" }, { id: "54", value: amount.toFixed(2) }].sort((a, b) => a.id.localeCompare(b.id))
  const body = all.map(f => field(f.id, f.value)).join("") + "6304"
  return body + crc16(body)
}

/** True for a payment QR we can show (and put an amount into). */
export const isPaymentQr = (payload: string) => parseEmv(payload) !== null

/**
 * What a friend scans to pay `amount`: from a PromptPay number, or from the payer's own QR. `exact`
 * says whether the amount is inside the code (otherwise they type it themselves).
 */
export function payQr(payee: { promptPayId: string | null; qrPayload: string | null }, amount: number): { payload: string; exact: boolean } | null {
  if (payee.promptPayId) return { payload: generatePayload(payee.promptPayId, { amount }), exact: true }
  if (payee.qrPayload) {
    const priced = withAmount(payee.qrPayload, amount)
    return priced ? { payload: priced, exact: true } : { payload: payee.qrPayload, exact: false }
  }
  return null
}

/** "08x-xxx-1234": enough for the owner to recognise their number, not enough to read it off a screen. */
export function maskPromptPay(id: string) {
  return id.length <= 4 ? id : `${id.slice(0, 2)}${"x".repeat(Math.max(0, id.length - 6))}${id.slice(-4)}`
}
