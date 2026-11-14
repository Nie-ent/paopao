"use server"

import prisma from "@/lib/db"
import { Prisma } from "@prisma/client"
import { getCurrentUser } from "@/lib/current-user"
import { bangkokDate, bangkokDayKey, bangkokParts } from "@/lib/dates"
import { currentCycle, cycleFor, dailyAllowance, daysLeft, previousCycle, upcomingBills } from "@/lib/pay-cycle"
import { roundMoney } from '@/lib/money'

const BKK = "Asia/Bangkok"

export async function getDashboardData(timeframe: 'ALL' | 'YTD' | 'MONTH' | 'WEEK' = 'MONTH', selectedMonth?: number, selectedYear?: number, locale: 'th-TH' | 'en-US' = 'en-US') {
  const prismaUser = await getCurrentUser()
  if (!prismaUser) return { error: "User not found" }

  // All calendar math is in Bangkok time; the server runs in UTC
  const now = new Date()
  const today = bangkokParts(now)
  // Months follow the user's pay cycle (payday to payday) when they set a payday: src/lib/pay-cycle.ts
  const payday = prismaUser.payday ?? null
  const current = currentCycle(payday, now)
  const cycle = selectedMonth && selectedYear ? cycleFor(payday, selectedYear, selectedMonth - 1) : current
  const isCurrent = cycle.gte.getTime() === current.gte.getTime()
  let dateFilter: { gte: Date; lt?: Date } | null = null

  if (timeframe === 'YTD') {
    dateFilter = { gte: bangkokDate(today.year, 0, 1) }
  } else if (timeframe === 'MONTH') {
    dateFilter = { gte: cycle.gte, lt: cycle.lt }
  } else if (timeframe === 'WEEK') {
    dateFilter = { gte: bangkokDate(today.year, today.month, today.day - 6) }
  }

  const whereClause: Prisma.TransactionWhereInput = { userId: prismaUser.id }
  if (dateFilter) whereClause.date = dateFilter

  const transactions = await prisma.transaction.findMany({
    where: whereClause,
    orderBy: { date: 'asc' },
    include: { category: true }
  })
  
  const chartDataMap: Record<string, { name: string, income: number, expense: number }> = {}

  if (timeframe === 'YTD') {
    for (let i = 0; i <= today.month; i++) {
      const key = bangkokDate(today.year, i, 1).toLocaleString(locale, { month: 'short', timeZone: BKK })
      chartDataMap[i.toString()] = { name: key, income: 0, expense: 0 }
    }
    for (const t of transactions) {
      const month = bangkokParts(t.date).month.toString()
      if (chartDataMap[month]) {
        if (t.type === 'INCOME') chartDataMap[month].income += Number(t.amount)
        if (t.type === 'EXPENSE') chartDataMap[month].expense += Number(t.amount)
      }
    }
  } else if (timeframe === 'MONTH') {
    // One column per day of the cycle; a cycle crossing months labels days "25/10"
    const crosses = bangkokParts(cycle.gte).month !== bangkokParts(new Date(cycle.lt.getTime() - 1)).month
    for (let d = cycle.gte; d < cycle.lt; d = new Date(d.getTime() + 86_400_000)) {
      const p = bangkokParts(d)
      chartDataMap[bangkokDayKey(d)] = { name: crosses ? `${p.day}/${p.month + 1}` : String(p.day), income: 0, expense: 0 }
    }
    for (const t of transactions) {
      const day = chartDataMap[bangkokDayKey(t.date)]
      if (!day) continue
      if (t.type === 'INCOME') day.income += Number(t.amount)
      if (t.type === 'EXPENSE') day.expense += Number(t.amount)
    }
  } else if (timeframe === 'WEEK') {
    for (let i = 6; i >= 0; i--) {
      const d = bangkokDate(today.year, today.month, today.day - i)
      chartDataMap[bangkokDayKey(d)] = { name: d.toLocaleDateString(locale, { weekday: 'short', timeZone: BKK }), income: 0, expense: 0 }
    }
    for (const t of transactions) {
      const day = chartDataMap[bangkokDayKey(t.date)]
      if (!day) continue
      if (t.type === 'INCOME') day.income += Number(t.amount)
      if (t.type === 'EXPENSE') day.expense += Number(t.amount)
    }
  } else if (timeframe === 'ALL') {
    for (const t of transactions) {
      const { year, month: monthIndex } = bangkokParts(t.date);
      const month = t.date.toLocaleString(locale, { month: 'short', timeZone: BKK });
      const key = `${month} ${locale === 'th-TH' ? year + 543 : year}`;
      const sortKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
      
      if (!chartDataMap[key]) {
        chartDataMap[key] = { name: key, income: 0, expense: 0, _sortKey: sortKey } as any;
      }
      
      if (t.type === 'INCOME') chartDataMap[key].income += Number(t.amount);
      if (t.type === 'EXPENSE') chartDataMap[key].expense += Number(t.amount);
    }
  }


  // Totals and Breakdown using the Filtered Transactions!
  let totalIncome = 0
  let totalExpense = 0
  const incomeCategoryMap: Record<string, { value: number, color: string }> = {}
  const expenseCategoryMap: Record<string, { value: number, color: string }> = {}

  for (const agg of transactions) {
    const amt = Number(agg.amount)
    const catName = agg.category?.name || 'Other'
    const catColor = agg.category?.color || '#888'
    
    if (agg.type === 'INCOME') {
      totalIncome += amt
      if (!incomeCategoryMap[catName]) incomeCategoryMap[catName] = { value: 0, color: catColor }
      incomeCategoryMap[catName].value += amt
    } else if (agg.type === 'EXPENSE') {
      totalExpense += amt
      if (!expenseCategoryMap[catName]) expenseCategoryMap[catName] = { value: 0, color: catColor }
      expenseCategoryMap[catName].value += amt
    }
  }

  const incomeByCategory = Object.entries(incomeCategoryMap).map(([name, data]) => ({ name, value: roundMoney(data.value), color: data.color })).sort((a,b) => b.value - a.value)
  const expenseByCategory = Object.entries(expenseCategoryMap).map(([name, data]) => ({ name, value: roundMoney(data.value), color: data.color })).sort((a,b) => b.value - a.value)

  let chartDataValues: any[] = Object.values(chartDataMap).map(d => ({ ...d, income: roundMoney(d.income), expense: roundMoney(d.expense) }));
  if (timeframe === 'ALL') {
    chartDataValues.sort((a, b) => a._sortKey.localeCompare(b._sortKey));
    chartDataValues = chartDataValues.map(({ _sortKey, ...rest }) => rest);
  }

  const sumsOf = (rows: { type: string; _sum: { amount: number | null } }[]) => ({
    totalIncome: roundMoney(Number(rows.find(s => s.type === 'INCOME')?._sum.amount ?? 0)),
    totalExpense: roundMoney(Number(rows.find(s => s.type === 'EXPENSE')?._sum.amount ?? 0)),
  })
  // The cycle before, so the dashboard can say whether spending went up or down
  let previous: { totalIncome: number; totalExpense: number } | null = null
  // Money left from before this cycle, so a cycle doesn't start at zero (and look like a loss until payday)
  let carryOver: number | null = null
  // What can be spent per day until the next payday, after fixed costs still to come
  let allowance: (ReturnType<typeof dailyAllowance> & { daysLeft: number; upcoming: number; onHand: number }) | null = null
  if (timeframe === 'MONTH') {
    const prev = previousCycle(payday, cycle)
    const [prevSums, beforeSums] = await Promise.all([
      prisma.transaction.groupBy({ by: ['type'], where: { userId: prismaUser.id, date: { gte: prev.gte, lt: prev.lt } }, _sum: { amount: true } }),
      prisma.transaction.groupBy({ by: ['type'], where: { userId: prismaUser.id, date: { lt: cycle.gte } }, _sum: { amount: true } }),
    ])
    previous = sumsOf(prevSums)
    const before = sumsOf(beforeSums)
    // Only money left over carries; a negative history (often: only spending was logged, never
    // income) would make every cycle start in the red again
    carryOver = Math.max(0, roundMoney(before.totalIncome - before.totalExpense))

    // Without income or money carried over there is nothing to spread over the days
    if (isCurrent && (totalIncome > 0 || carryOver > 0)) {
      const bills = await prisma.recurringBill.findMany({ where: { userId: prismaUser.id, active: true } })
      const paid = await prisma.transaction.findMany({
        where: { userId: prismaUser.id, reference: { startsWith: 'BILL-' }, date: { gte: cycle.gte } },
        select: { reference: true },
      })
      // References look like BILL-<billId>-<YYYY-MM-DD>
      const paidKeys = new Set(paid.map(p => p.reference!.slice(5)).map(r => `${r.slice(0, -11)}|${r.slice(-10)}`))
      const upcoming = upcomingBills(bills, cycle, paidKeys, now)
      const onHand = roundMoney(carryOver + totalIncome - totalExpense)
      const days = daysLeft(cycle, now)
      allowance = { ...dailyAllowance(onHand, upcoming, days), daysLeft: days, upcoming, onHand }
    }
  }

  return {
    previous,
    carryOver,
    allowance,
    /** The cycle shown: its name (1-based month) and first/last day, and the payday behind it */
    period: { year: cycle.year, month: cycle.month + 1, start: bangkokDayKey(cycle.gte), end: bangkokDayKey(new Date(cycle.lt.getTime() - 1)), payday, isCurrent },
    chartData: chartDataValues,
    incomeByCategory,
    expenseByCategory,
    stats: {
      totalBalance: roundMoney(totalIncome - totalExpense),
      totalIncome: roundMoney(totalIncome),
      totalExpense: roundMoney(totalExpense),
    },
    paoPoints: prismaUser.paoPoints,
    lastDailyQuestAt: prismaUser.lastDailyQuestAt
  }
}
