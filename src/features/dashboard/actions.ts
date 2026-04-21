"use server"

import prisma from "@/lib/db"
import { getUser } from "@/features/auth/actions"

export async function getDashboardData(timeframe: 'ALL' | 'YTD' | 'MONTH' | 'WEEK' = 'MONTH') {
  const user = await getUser()
  
  if (!user) {
    return null
  }

  let lineId = "U9f4477a859862ce8589b09e879ec068c"
  if (user.app_metadata?.provider === "line") {
    lineId = (user as any).user_metadata.provider_id
  }

  const prismaUser = await prisma.user.findUnique({
    where: { lineId }
  })

  if (!prismaUser) {
    return { error: "User not found in DB" }
  }

  const now = new Date()
  let startDate = new Date()

  if (timeframe === 'YTD') {
    startDate = new Date(now.getFullYear(), 0, 1)
  } else if (timeframe === 'MONTH') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1)
  } else if (timeframe === 'WEEK') {
    startDate = new Date(now)
    startDate.setDate(now.getDate() - 6)
    startDate.setHours(0, 0, 0, 0)
  }

  const whereClause: any = { userId: prismaUser.id }
  if (timeframe !== 'ALL') {
    whereClause.date = { gte: startDate }
  }

  const transactions = await prisma.transaction.findMany({
    where: whereClause,
    orderBy: { date: 'asc' }
  })
  
  const chartDataMap: Record<string, { name: string, income: number, expense: number }> = {}

  if (timeframe === 'YTD') {
    for (let i = 0; i <= now.getMonth(); i++) {
      const d = new Date(now.getFullYear(), i, 1)
      const key = d.toLocaleString('en-US', { month: 'short' })
      chartDataMap[i.toString()] = { name: key, income: 0, expense: 0 }
    }
    for (const t of transactions) {
      const m = t.date.getMonth().toString()
      if (chartDataMap[m]) {
        if (t.type === 'INCOME') chartDataMap[m].income += Number(t.amount)
        if (t.type === 'EXPENSE') chartDataMap[m].expense += Number(t.amount)
      }
    }
  } else if (timeframe === 'MONTH') {
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    for (let i = 1; i <= daysInMonth; i++) {
      chartDataMap[i.toString()] = { name: i.toString(), income: 0, expense: 0 }
    }
    for (const t of transactions) {
      const d = t.date.getDate().toString()
      if (chartDataMap[d]) {
        if (t.type === 'INCOME') chartDataMap[d].income += Number(t.amount)
        if (t.type === 'EXPENSE') chartDataMap[d].expense += Number(t.amount)
      }
    }
  } else if (timeframe === 'WEEK') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' })
      chartDataMap[d.toDateString()] = { name: dayName, income: 0, expense: 0 }
    }
    for (const t of transactions) {
      if (t.type === 'INCOME') chartDataMap[t.date.toDateString()].income += Number(t.amount)
      if (t.type === 'EXPENSE') chartDataMap[t.date.toDateString()].expense += Number(t.amount)
    }
  } else if (timeframe === 'ALL') {
    for (const t of transactions) {
      const year = t.date.getFullYear();
      const month = t.date.toLocaleString('en-US', { month: 'short' });
      const key = `${month} ${year}`;
      const sortKey = `${year}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
      
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
  const incomeCategoryMap: Record<string, number> = {}
  const expenseCategoryMap: Record<string, number> = {}

  for (const agg of transactions) {
    const amt = Number(agg.amount)
    if (agg.type === 'INCOME') {
      totalIncome += amt
      incomeCategoryMap[agg.category || 'Other'] = (incomeCategoryMap[agg.category || 'Other'] || 0) + amt
    } else if (agg.type === 'EXPENSE') {
      totalExpense += amt
      expenseCategoryMap[agg.category || 'Other'] = (expenseCategoryMap[agg.category || 'Other'] || 0) + amt
    }
  }

  const incomeByCategory = Object.entries(incomeCategoryMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value)
  const expenseByCategory = Object.entries(expenseCategoryMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value)

  let chartDataValues: any[] = Object.values(chartDataMap);
  if (timeframe === 'ALL') {
    chartDataValues.sort((a, b) => a._sortKey.localeCompare(b._sortKey));
    chartDataValues = chartDataValues.map(({ _sortKey, ...rest }) => rest);
  }

  return {
    chartData: chartDataValues,
    incomeByCategory,
    expenseByCategory,
    stats: {
      totalBalance: totalIncome - totalExpense,
      totalIncome: totalIncome,
      totalExpense: totalExpense,
    }
  }
}
