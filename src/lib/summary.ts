/**
 * Income/expense summaries for "สรุป" in LINE: today, this month or this year, in Bangkok time.
 * Pure: takes transactions, returns totals, chart buckets and top categories.
 */
import { bangkokDate, bangkokParts } from "@/lib/dates"

export type SummaryPeriod = "DAY" | "MONTH" | "YEAR"
export const SUMMARY_PERIODS: SummaryPeriod[] = ["DAY", "MONTH", "YEAR"]

type Tx = { type: string; amount: number; date: Date; category: { name: string; color?: string | null } | null }

export type SummaryBucket = { label: string; income: number; expense: number }
export type SummaryCategory = { name: string; amount: number; color: string | null }
export type Summary = {
  period: SummaryPeriod
  /** e.g. "8 พ.ย. 2569", "พฤศจิกายน 2569", "ปี 2569" */
  title: string
  income: number
  expense: number
  net: number
  count: number
  /** Chart columns: days of the month or months of the year (empty for DAY) */
  buckets: SummaryBucket[]
  /** Expense categories, largest first */
  topCategories: SummaryCategory[]
}

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
const TH_MONTHS_LONG = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"]
const buddhistYear = (y: number) => y + 543

/** [start, end) of the Bangkok day, month or year containing `now`. */
export function summaryRange(period: SummaryPeriod, now = new Date()) {
  const { year, month, day } = bangkokParts(now)
  if (period === "DAY") return { gte: bangkokDate(year, month, day), lt: bangkokDate(year, month, day + 1) }
  if (period === "MONTH") return { gte: bangkokDate(year, month, 1), lt: bangkokDate(year, month + 1, 1) }
  return { gte: bangkokDate(year, 0, 1), lt: bangkokDate(year + 1, 0, 1) }
}

export function buildSummary(period: SummaryPeriod, transactions: Tx[], now = new Date()): Summary {
  const { year, month, day } = bangkokParts(now)
  const income = transactions.filter(t => t.type === "INCOME").reduce((s, t) => s + t.amount, 0)
  const expense = transactions.filter(t => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0)

  // Chart columns
  let buckets: SummaryBucket[] = []
  if (period === "MONTH") {
    const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    buckets = Array.from({ length: days }, (_, i) => ({ label: String(i + 1), income: 0, expense: 0 }))
    for (const t of transactions) {
      const b = buckets[bangkokParts(t.date).day - 1]
      if (b) b[t.type === "INCOME" ? "income" : "expense"] += t.amount
    }
  } else if (period === "YEAR") {
    buckets = TH_MONTHS.map(label => ({ label, income: 0, expense: 0 }))
    for (const t of transactions) {
      const b = buckets[bangkokParts(t.date).month]
      if (b) b[t.type === "INCOME" ? "income" : "expense"] += t.amount
    }
  }

  const byCategory = new Map<string, SummaryCategory>()
  for (const t of transactions) {
    if (t.type !== "EXPENSE") continue
    const name = t.category?.name || "Other Expense"
    const entry = byCategory.get(name) ?? { name, amount: 0, color: t.category?.color ?? null }
    entry.amount += t.amount
    byCategory.set(name, entry)
  }
  const topCategories = [...byCategory.values()].sort((a, b) => b.amount - a.amount)

  const title = period === "DAY"
    ? `${day} ${TH_MONTHS[month]} ${buddhistYear(year)}`
    : period === "MONTH" ? `${TH_MONTHS_LONG[month]} ${buddhistYear(year)}` : `ปี ${buddhistYear(year)}`

  return { period, title, income, expense, net: income - expense, count: transactions.length, buckets, topCategories }
}

// Postback data for the period buttons: "summary|DAY" etc.
export const encodeSummaryAnswer = (p: SummaryPeriod) => `summary|${p}`
export function parseSummaryAnswer(data: string): SummaryPeriod | null {
  const parts = data.split("|")
  if (parts.length !== 2 || parts[0] !== "summary") return null
  return SUMMARY_PERIODS.includes(parts[1] as SummaryPeriod) ? (parts[1] as SummaryPeriod) : null
}

/** Typed words that open the summary picker */
export const isSummaryRequest = (text: string) => /^(สรุป|สรุปยอด|สรุปรายรับรายจ่าย|ดูสรุป|summary|report)$/i.test(text.trim())
