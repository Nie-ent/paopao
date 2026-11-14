/**
 * Pay cycles: someone paid on the 25th thinks of "this month" as the 25th to the 24th, not the
 * 1st to the 31st, or the start of every month looks like a loss. With a payday set (User.payday),
 * dashboard periods, the monthly analysis and LINE's "this month" summary follow the cycle.
 * Without one, a cycle is the calendar month. Pure; dates are Bangkok calendar days.
 *
 * A cycle is named after the month holding most of its days: with payday 25, 25 Oct – 24 Nov is
 * "November"; with payday 5, 5 Nov – 4 Dec is also "November".
 */
import { bangkokDate, bangkokParts } from "@/lib/dates"
import { isBillDue, type BillFrequency } from "@/lib/bills"

const DAY_MS = 24 * 60 * 60 * 1000

/** The payday in a given month (a payday past the month's end falls on its last day), as a Bangkok midnight. */
function paydayIn(year: number, month: number, payday: number) {
  const norm = new Date(Date.UTC(year, month, 1))
  const y = norm.getUTCFullYear(), m = norm.getUTCMonth()
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  return bangkokDate(y, m, Math.min(payday, last))
}

export type Cycle = { gte: Date; lt: Date; year: number; month: number }

/** The cycle named `month` (0-based) of `year`. */
export function cycleFor(payday: number | null, year: number, month: number): Cycle {
  if (!payday || payday === 1) return { gte: bangkokDate(year, month, 1), lt: bangkokDate(year, month + 1, 1), year, month }
  const startMonth = payday >= 16 ? month - 1 : month
  return { gte: paydayIn(year, startMonth, payday), lt: paydayIn(year, startMonth + 1, payday), year, month }
}

/** The cycle that contains `now`. */
export function currentCycle(payday: number | null, now = new Date()): Cycle {
  const { year, month } = bangkokParts(now)
  for (const offset of [0, 1, -1]) {
    const c = cycleFor(payday, year, month + offset)
    if (now >= c.gte && now < c.lt) {
      const norm = new Date(Date.UTC(year, month + offset, 1))
      return { ...c, year: norm.getUTCFullYear(), month: norm.getUTCMonth() }
    }
  }
  return cycleFor(payday, year, month)
}

/** The cycle before `c`. */
export function previousCycle(payday: number | null, c: Pick<Cycle, "year" | "month">): Cycle {
  const norm = new Date(Date.UTC(c.year, c.month - 1, 1))
  return cycleFor(payday, norm.getUTCFullYear(), norm.getUTCMonth())
}

/** Bangkok days from `now`'s day to the cycle's last day, counting today. */
export function daysLeft(c: Pick<Cycle, "lt">, now = new Date()) {
  const { year, month, day } = bangkokParts(now)
  return Math.max(0, Math.round((c.lt.getTime() - bangkokDate(year, month, day).getTime()) / DAY_MS))
}

/**
 * The payday a salary history suggests: the usual Bangkok day of the month of the biggest income
 * each month, when at least 2 of the last months agree within 2 days. Null when there is no pattern.
 * Days late in the month (28+) count as month-end and are reported as the median of those seen.
 */
export function suggestPayday(incomes: { date: Date; amount: number }[]): number | null {
  const biggest = new Map<string, { day: number; amount: number }>()
  for (const t of incomes) {
    const { year, month, day } = bangkokParts(t.date)
    const key = `${year}-${month}`
    if (!biggest.has(key) || t.amount > biggest.get(key)!.amount) biggest.set(key, { day, amount: t.amount })
  }
  const days = [...biggest.values()].map(b => b.day).sort((a, b) => a - b)
  if (days.length < 2) return null
  const median = days[Math.floor(days.length / 2)]
  const close = days.filter(d => Math.abs(d - median) <= 2)
  if (close.length < 2 || close.length < days.length * 0.6) return null
  return median === 1 ? null : median
}

type Bill = { id: string; amount: number | null; frequency: BillFrequency; dayOfWeek: number | null; dayOfMonth: number | null; active: boolean }

/**
 * Fixed costs still to come before the cycle ends: each active bill's occurrences from today to
 * the cycle's last day, minus those already recorded (`paidKeys` = "billId|YYYY-MM-DD").
 */
export function upcomingBills(bills: Bill[], c: Pick<Cycle, "lt">, paidKeys: Set<string>, now = new Date()) {
  const { year, month, day } = bangkokParts(now)
  let total = 0
  for (let d = bangkokDate(year, month, day); d < c.lt; d = new Date(d.getTime() + DAY_MS)) {
    const p = bangkokParts(d)
    const key = `${p.year}-${String(p.month + 1).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`
    for (const b of bills) {
      if (b.amount && isBillDue(b, new Date(d.getTime() + 12 * 60 * 60 * 1000)) && !paidKeys.has(`${b.id}|${key}`)) total += b.amount
    }
  }
  return Math.round(total * 100) / 100
}

/**
 * What can be spent per day until the cycle ends: money on hand minus fixed costs still to come,
 * over the days left. A shortfall when the money won't cover those costs.
 */
export function dailyAllowance(onHand: number, upcoming: number, days: number) {
  const spare = Math.round((onHand - upcoming) * 100) / 100
  if (days <= 0) return { perDay: null, spare, shortfall: spare < 0 ? -spare : 0 }
  return { perDay: spare > 0 ? Math.floor((spare / days) * 100) / 100 : 0, spare, shortfall: spare < 0 ? -spare : 0 }
}
