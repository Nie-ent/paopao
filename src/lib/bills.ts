/**
 * Recurring bills (Pro): when a bill is due, PaoPao asks about it on LINE with one-tap answers
 * (quick reply postbacks); tapping one records the expense. Pure helpers, no I/O.
 */
import { bangkokDayKey, bangkokParts } from "@/lib/dates"
import { billQuestionCard } from "@/lib/line-cards"

export type BillFrequency = "DAILY" | "WEEKLY" | "MONTHLY"
type DueFields = { frequency: BillFrequency; dayOfWeek: number | null; dayOfMonth: number | null; active: boolean }
type AskFields = { id: string; name: string; amount: number | null }

/** Is the bill due on the Bangkok calendar day of `now`? A monthly day past the month's end falls on its last day. */
export function isBillDue(bill: DueFields, now = new Date()) {
  if (!bill.active) return false
  const { year, month, day } = bangkokParts(now)
  if (bill.frequency === "DAILY") return true
  if (bill.frequency === "WEEKLY") return new Date(Date.UTC(year, month, day)).getUTCDay() === bill.dayOfWeek
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return bill.dayOfMonth !== null && Math.min(bill.dayOfMonth, lastDay) === day
}

// Postback data: "bill|<billId>|<YYYY-MM-DD>|pay|<amount>" or "...|other"
export type BillAnswer =
  | { billId: string; day: string; kind: "pay"; amount: number }
  | { billId: string; day: string; kind: "other" }

export function encodeBillAnswer(a: BillAnswer) {
  return a.kind === "pay" ? `bill|${a.billId}|${a.day}|pay|${a.amount}` : `bill|${a.billId}|${a.day}|other`
}

export function parseBillAnswer(data: string): BillAnswer | null {
  const [tag, billId, day, kind, amount] = data.split("|")
  if (tag !== "bill" || !billId || !/^\d{4}-\d{2}-\d{2}$/.test(day ?? "")) return null
  if (kind === "other") return { billId, day, kind }
  const value = Number(amount)
  if (kind === "pay" && Number.isFinite(value) && value > 0 && value <= 100_000_000) return { billId, day, kind, amount: value }
  return null
}

/** Reference stored on the recorded transaction; unique per user, so a double tap records once. */
export const billReference = (billId: string, day: string) => `BILL-${billId}-${day}`

const baht = (n: number) => `฿${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
const QUICK_REPLY_MAX = 13
const LABEL_MAX = 20 // LINE limit for quick reply labels

/**
 * The LINE message asking about today's bills: a card with a button per bill, plus the same
 * answers as quick replies (they sit above the keyboard until the user replies).
 */
export function buildBillQuestion(bills: AskFields[], now = new Date(), billsUrl = "/bills") {
  const day = bangkokDayKey(now)
  const asked = bills.slice(0, QUICK_REPLY_MAX)
  const actions = asked.map(b => {
    const answer: BillAnswer = b.amount ? { billId: b.id, day, kind: "pay", amount: b.amount } : { billId: b.id, day, kind: "other" }
    return {
      label: (b.amount ? `${b.name} ${baht(b.amount)}` : `${b.name}: ใส่ยอด`).slice(0, LABEL_MAX),
      data: encodeBillAnswer(answer),
      displayText: b.amount ? `จ่าย${b.name} ${baht(b.amount)} แล้ว` : `ใส่ยอด${b.name}`,
    }
  })
  const quickReply = { items: actions.map(a => ({ type: "action" as const, action: { type: "postback" as const, ...a } })) }
  return billQuestionCard(asked, actions, quickReply, billsUrl)
}
