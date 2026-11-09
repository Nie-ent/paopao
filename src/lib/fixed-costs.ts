/**
 * Fixed costs: what a user pays every month no matter what (rent, phone, subscriptions, loan
 * payments), built from their recurring bills. Shows how much of their income is already spoken
 * for, splits essential from optional ("could cut"), and finds payments that repeat every month
 * in their entries but aren't listed yet (forgotten subscriptions: the "leaks").
 * The summary also feeds the AI chat and insights. Pure helpers, no I/O.
 */
import { bangkokParts } from "@/lib/dates"
import { roundMoney } from "@/lib/money"

export type Frequency = "DAILY" | "WEEKLY" | "MONTHLY"
export type FixedBill = { id?: string; name: string; category: string; amount: number | null; frequency: Frequency; active: boolean; essential: boolean }

/** A bill's cost per month: weekly ones happen 52/12 times a month, daily ones 365/12. */
export function monthlyAmount(b: Pick<FixedBill, "amount" | "frequency">) {
  if (!b.amount) return 0
  const perMonth = b.frequency === "DAILY" ? 365 / 12 : b.frequency === "WEEKLY" ? 52 / 12 : 1
  return roundMoney(b.amount * perMonth)
}

export type FixedCostSummary = {
  total: number
  essential: number
  optional: number
  /** Bills without a usual amount (not counted in the totals) */
  withoutAmount: number
  /** Average monthly income over the last months with data, or null when there is none */
  avgIncome: number | null
  /** Share of income already committed, 0–100+, or null without income */
  percentOfIncome: number | null
  /** Income left after fixed costs, or null without income */
  freeCash: number | null
  items: { name: string; category: string; monthly: number; essential: boolean }[]
}

export function summarizeFixedCosts(bills: FixedBill[], avgIncome: number | null): FixedCostSummary {
  const active = bills.filter(b => b.active)
  const items = active.map(b => ({ name: b.name, category: b.category, monthly: monthlyAmount(b), essential: b.essential }))
    .sort((a, b) => b.monthly - a.monthly)
  const sum = (xs: number[]) => roundMoney(xs.reduce((s, x) => s + x, 0))
  const total = sum(items.map(i => i.monthly))
  const income = avgIncome && avgIncome > 0 ? avgIncome : null
  return {
    total,
    essential: sum(items.filter(i => i.essential).map(i => i.monthly)),
    optional: sum(items.filter(i => !i.essential).map(i => i.monthly)),
    withoutAmount: active.filter(b => !b.amount).length,
    avgIncome: income === null ? null : roundMoney(income),
    percentOfIncome: income === null ? null : Math.round((total / income) * 100),
    freeCash: income === null ? null : roundMoney(income - total),
    items,
  }
}

/**
 * Average monthly income over the last three calendar months (Bangkok) the account has data for.
 * The current month is left out while no income has arrived yet (salary usually comes later in the
 * month), and so is the first month if the account started after the 10th of it (a partial month).
 */
export function averageMonthlyIncome(incomes: { amount: number; date: Date }[], firstEntryAt: Date | null, now = new Date()) {
  if (!firstEntryAt || incomes.length === 0) return null
  const key = (y: number, m: number) => y * 12 + m
  const { year, month } = bangkokParts(now)
  const first = bangkokParts(firstEntryAt)
  const nowKey = key(year, month)
  let months: number[] = []
  for (let k = Math.max(nowKey - 2, key(first.year, first.month)); k <= nowKey; k++) months.push(k)
  const byMonth = new Map<number, number>()
  for (const t of incomes) { const p = bangkokParts(t.date); const k = key(p.year, p.month); byMonth.set(k, (byMonth.get(k) ?? 0) + t.amount) }
  if (months.length > 1 && !byMonth.get(nowKey)) months = months.filter(k => k !== nowKey)
  if (months.length > 1 && months[0] === key(first.year, first.month) && first.day > 10) months = months.slice(1)
  const total = months.reduce((s, k) => s + (byMonth.get(k) ?? 0), 0)
  return total > 0 ? roundMoney(total / months.length) : null
}

export type Suggestion = { name: string; category: string; amount: number; dayOfMonth: number; months: number }

const normalize = (s: string) => s.toLowerCase().normalize("NFC").replace(/[\d.,฿]+/g, " ").replace(/\s+/g, " ").trim()
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }

/**
 * Expenses that look like a monthly payment the user hasn't listed: the same note in at least two
 * of the last three calendar months, about once a month, for a similar amount (±20%). Daily things
 * like coffee repeat too often to count. Notes already covered by a bill are left out.
 */
export function suggestFixedCosts(
  expenses: { note: string | null; amount: number; date: Date; category: string }[],
  bills: Pick<FixedBill, "name" | "category" | "amount">[],
  now = new Date(),
  limit = 5,
): Suggestion[] {
  const { year, month } = bangkokParts(now)
  const recentMonths = new Set([0, 1, 2].map(k => { const d = new Date(Date.UTC(year, month - k, 1)); return `${d.getUTCFullYear()}-${d.getUTCMonth()}` }))
  const billNames = bills.map(b => normalize(b.name)).filter(Boolean)

  const groups = new Map<string, { note: string; category: string; rows: { amount: number; date: Date; monthKey: string }[] }>()
  for (const e of expenses) {
    const key = normalize(e.note ?? "")
    if (key.length < 2 || key === "-") continue
    const p = bangkokParts(e.date)
    const monthKey = `${p.year}-${p.month}`
    if (!recentMonths.has(monthKey)) continue
    const g = groups.get(key) ?? { note: (e.note ?? "").trim(), category: e.category, rows: [] }
    g.rows.push({ amount: e.amount, date: e.date, monthKey })
    groups.set(key, g)
  }

  const out: Suggestion[] = []
  for (const [key, g] of groups) {
    const months = new Set(g.rows.map(r => r.monthKey)).size
    if (months < 2) continue
    if (g.rows.length > months * 2) continue // more than ~twice a month: everyday spending, not a bill
    const mid = median(g.rows.map(r => r.amount))
    if (mid < 20) continue
    const similar = g.rows.filter(r => Math.abs(r.amount - mid) <= mid * 0.2).length
    if (similar / g.rows.length < 0.8) continue
    const covered = billNames.some(n => n === key || n.includes(key) || key.includes(n)) ||
      bills.some(b => b.category === g.category && b.amount && Math.abs(b.amount - mid) <= mid * 0.1)
    if (covered) continue
    const latest = g.rows.reduce((a, b) => (a.date > b.date ? a : b))
    out.push({ name: g.note.slice(0, 40), category: g.category, amount: roundMoney(mid), dayOfMonth: bangkokParts(latest.date).day, months })
  }
  return out.sort((a, b) => b.amount - a.amount).slice(0, limit)
}

/** Lines for the AI's context (chat and insights), in the user's language. */
export function fixedCostContext(s: FixedCostSummary, lang: "th" | "en") {
  if (s.items.length === 0) {
    return lang === "th" ? "- ยังไม่ได้บันทึกค่าใช้จ่ายคงที่" : "- No fixed costs listed yet"
  }
  const baht = (n: number) => `฿${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
  const list = s.items.slice(0, 12).map(i => `${i.name} ${baht(i.monthly)}${i.essential ? "" : lang === "th" ? " (ตัดได้)" : " (optional)"}`).join(", ")
  return lang === "th"
    ? [
        `- ค่าใช้จ่ายคงที่ต่อเดือน: ${baht(s.total)} (จำเป็น ${baht(s.essential)}, ตัดได้ ${baht(s.optional)})`,
        `- รายการ: ${list}`,
        s.avgIncome !== null ? `- รายรับเฉลี่ยต่อเดือน: ${baht(s.avgIncome)} → ค่าใช้จ่ายคงที่คิดเป็น ${s.percentOfIncome}% เหลือเงินใช้ได้หลังหักค่าใช้จ่ายคงที่ ${baht(s.freeCash!)}` : "- ยังไม่มีข้อมูลรายรับ",
      ].join("\n")
    : [
        `- Fixed costs per month: ${baht(s.total)} (essential ${baht(s.essential)}, optional ${baht(s.optional)})`,
        `- Items: ${list}`,
        s.avgIncome !== null ? `- Average monthly income: ${baht(s.avgIncome)} → fixed costs are ${s.percentOfIncome}%, leaving ${baht(s.freeCash!)} a month` : "- No income recorded yet",
      ].join("\n")
}
