import { isValidAmount } from "@/lib/money"
/**
 * Makes amounts in a LINE message easy to read for both the rule-based parser and the AI:
 * "1,500" → "1500", Thai digits "๑๕๐" → "150", "1.5k" → "1500", "฿1,200" → "฿1200".
 * Only commas that separate thousands are removed, so "ข้าว 50, น้ำ 20" keeps its comma.
 */
const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙"

export function normalizeAmountText(text: string): string {
  let s = text.replace(/[๐-๙]/g, d => String(THAI_DIGITS.indexOf(d)))
  // Full-width digits and comma (some keyboards)
  s = s.replace(/[０-９]/g, d => String(d.charCodeAt(0) - 0xff10)).replace(/，/g, ",")
  // 1,500 / 12,345,678.50 → digits only (a group of exactly 3 digits after each comma)
  s = s.replace(/\d{1,3}(?:,\d{3})+(?:\.\d+)?(?!\d)/g, m => m.replace(/,/g, ""))
  // 1.5k / 2K → 1500 / 2000 (not inside words like "1kg")
  s = s.replace(/(\d+(?:\.\d+)?)\s?[kK](?![a-zA-Z])/g, (_, n) => String(Math.round(Number(n) * 1000)))
  return s
}

/** The amount when a message is only a number (an edited amount), e.g. "1,250", "฿80", "80 บาท". */
export function parseAmountOnly(text: string): number | null {
  const s = normalizeAmountText(text.trim()).replace(/฿|บาท|thb|baht/gi, "").replace(/\s+/g, "")
  if (!/^\d+(?:\.\d{1,2})?$/.test(s)) return null
  const n = Number(s)
  return isValidAmount(n) ? n : null
}
