/**
 * The user's money picture, for the fixed-costs page and as context for the AI chat and insights:
 * fixed costs vs. average income, plus this month's totals, top spending and goals.
 */
import prisma from "@/lib/db"
import { bangkokDate, bangkokParts } from "@/lib/dates"
import { averageMonthlyIncome, fixedCostContext, suggestFixedCosts, summarizeFixedCosts } from "@/lib/fixed-costs"
import { roundMoney } from "@/lib/money"

/** Fixed-cost summary and "looks like a monthly payment" suggestions for a user. */
export async function loadFixedCosts(userId: string, now = new Date()) {
  const { year, month } = bangkokParts(now)
  const since3m = bangkokDate(year, month - 2, 1)
  const [bills, incomes, expenses, first] = await Promise.all([
    prisma.recurringBill.findMany({ where: { userId } }),
    prisma.transaction.findMany({ where: { userId, type: "INCOME", date: { gte: since3m } }, select: { amount: true, date: true } }),
    prisma.transaction.findMany({ where: { userId, type: "EXPENSE", date: { gte: since3m } }, select: { amount: true, date: true, note: true, category: { select: { name: true } } } }),
    prisma.transaction.findFirst({ where: { userId }, orderBy: { date: "asc" }, select: { date: true } }),
  ])
  const summary = summarizeFixedCosts(bills, averageMonthlyIncome(incomes, first?.date ?? null, now))
  const suggestions = suggestFixedCosts(expenses.map(e => ({ note: e.note, amount: e.amount, date: e.date, category: e.category?.name ?? "Other Expense" })), bills, now)
  return { summary, suggestions }
}

/** A short, factual picture of the user's money for the AI (no notes beyond bill names). */
export async function financeContext(userId: string, lang: "th" | "en", now = new Date()) {
  const { year, month } = bangkokParts(now)
  const monthStart = bangkokDate(year, month, 1)
  const [{ summary }, monthTx, goals] = await Promise.all([
    loadFixedCosts(userId, now),
    prisma.transaction.findMany({ where: { userId, date: { gte: monthStart } }, select: { type: true, amount: true, category: { select: { name: true } } } }),
    prisma.goal.findMany({ where: { userId, isCompleted: false }, select: { title: true, type: true, targetAmount: true, currentAmount: true, deadline: true }, take: 5 }),
  ])
  const baht = (n: number) => `฿${Math.round(n).toLocaleString("en-US")}`
  const income = roundMoney(monthTx.filter(t => t.type === "INCOME").reduce((s, t) => s + t.amount, 0))
  const expense = roundMoney(monthTx.filter(t => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0))
  const byCat = new Map<string, number>()
  for (const t of monthTx) if (t.type === "EXPENSE") byCat.set(t.category?.name ?? "Other", (byCat.get(t.category?.name ?? "Other") ?? 0) + t.amount)
  const top = [...byCat].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c, a]) => `${c} ${baht(a)}`).join(", ")
  const goalLines = goals.map(g => g.type === "FINANCIAL" ? `${g.title} ${baht(g.currentAmount)}/${baht(g.targetAmount)}` : g.title).join(", ")
  return lang === "th"
    ? [
        "# ข้อมูลการเงินของผู้ใช้ (ใช้ตอบคำถามและวางแผน ถ้าข้อมูลไม่พอให้ถามเพิ่ม)",
        `- เดือนนี้: รายรับ ${baht(income)}, รายจ่าย ${baht(expense)}${top ? ` (มากสุด: ${top})` : ""}`,
        fixedCostContext(summary, "th"),
        goalLines ? `- เป้าหมายที่กำลังทำ: ${goalLines}` : "- ยังไม่มีเป้าหมาย",
      ].join("\n")
    : [
        "# The user's money (use it to answer and plan; ask if something is missing)",
        `- This month: income ${baht(income)}, spending ${baht(expense)}${top ? ` (most: ${top})` : ""}`,
        fixedCostContext(summary, "en"),
        goalLines ? `- Goals in progress: ${goalLines}` : "- No goals yet",
      ].join("\n")
}
