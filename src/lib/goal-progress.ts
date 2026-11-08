import type { Prisma } from "@prisma/client"
import prisma from "@/lib/db"
import { bangkokDate, bangkokParts } from "@/lib/dates"

/** Special `trackCategory` values offered by the goal form besides real category names. */
export const DAILY_BALANCE = "DAILY_BALANCE"
const TYPE_TOTALS: Record<string, "INCOME" | "EXPENSE"> = { Income: "INCOME", Expense: "EXPENSE" }

type TrackedGoal = { userId: string; trackCategory: string | null; createdAt: Date; deadline: Date | null }

/**
 * Which transactions count toward a goal that syncs from transactions, in Bangkok calendar days:
 * - DAILY_BALANCE: the Bangkok day of `asOf`
 * - "Income" / "Expense": every transaction of that type
 * - anything else: transactions in that category
 * Non-daily goals count from the 1st of the month the goal was created through its deadline day,
 * so entries added retrospectively in that month are included.
 */
export function goalProgressWhere(goal: TrackedGoal, asOf = new Date()): Prisma.TransactionWhereInput | null {
  const track = goal.trackCategory
  if (!track) return null

  if (track === DAILY_BALANCE) {
    const d = bangkokParts(asOf)
    return { userId: goal.userId, date: { gte: bangkokDate(d.year, d.month, d.day), lt: bangkokDate(d.year, d.month, d.day + 1) } }
  }

  const created = bangkokParts(goal.createdAt)
  const date: Prisma.DateTimeFilter = { gte: bangkokDate(created.year, created.month, 1) }
  if (goal.deadline) {
    const end = bangkokParts(goal.deadline)
    date.lt = bangkokDate(end.year, end.month, end.day + 1)
  }
  const filter = TYPE_TOTALS[track] ? { type: TYPE_TOTALS[track] } : { category: { name: track } }
  return { userId: goal.userId, date, ...filter }
}

/** The synced amount for a goal, or null when the goal is tracked manually. */
export async function trackedGoalAmount(goal: TrackedGoal, asOf = new Date()) {
  const where = goalProgressWhere(goal, asOf)
  if (!where) return null

  if (goal.trackCategory === DAILY_BALANCE) {
    const totals = await prisma.transaction.groupBy({ by: ["type"], _sum: { amount: true }, where })
    const sum = (type: string) => totals.find(t => t.type === type)?._sum.amount || 0
    return sum("INCOME") - sum("EXPENSE")
  }

  const agg = await prisma.transaction.aggregate({ _sum: { amount: true }, where })
  return agg._sum.amount || 0
}
