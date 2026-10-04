"use server"

import prisma from "@/lib/db"
import { resolveLineId } from "@/lib/auth-user"
import { getUser } from "@/features/auth/actions"

export async function getDashboardData(timeframe: 'ALL' | 'YTD' | 'MONTH' | 'WEEK' = 'MONTH', selectedMonth?: number, selectedYear?: number, locale: 'th-TH' | 'en-US' = 'en-US') {
  const user = await getUser()
  
  if (!user) {
    return null
  }

  const lineId = resolveLineId(user)

  const prismaUser = await prisma.user.findUnique({
    where: { lineId }
  })

  if (!prismaUser) {
    return { error: "User not found in DB" }
  }

  const now = new Date()
  let startDate = new Date()
  let endDate: Date | null = null

  if (timeframe === 'YTD') {
    startDate = new Date(now.getFullYear(), 0, 1)
  } else if (timeframe === 'MONTH') {
    const y = selectedYear || now.getFullYear()
    const m = selectedMonth ? selectedMonth - 1 : now.getMonth()
    startDate = new Date(y, m, 1)
    endDate = new Date(y, m + 1, 0, 23, 59, 59, 999)
  } else if (timeframe === 'WEEK') {
    startDate = new Date(now)
    startDate.setDate(now.getDate() - 6)
    startDate.setHours(0, 0, 0, 0)
  }

  const whereClause: any = { userId: prismaUser.id }
  if (timeframe !== 'ALL') {
    whereClause.date = { gte: startDate }
    if (endDate) {
      whereClause.date.lte = endDate
    }
  }

  const transactions = await prisma.transaction.findMany({
    where: whereClause,
    orderBy: { date: 'asc' },
    include: { category: true }
  })
  
  const chartDataMap: Record<string, { name: string, income: number, expense: number }> = {}

  if (timeframe === 'YTD') {
    for (let i = 0; i <= now.getMonth(); i++) {
      const d = new Date(now.getFullYear(), i, 1)
      const key = d.toLocaleString(locale, { month: 'short' })
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
    const y = selectedYear || now.getFullYear()
    const m = selectedMonth ? selectedMonth - 1 : now.getMonth()
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    
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
      const dayName = d.toLocaleDateString(locale, { weekday: 'short' })
      chartDataMap[d.toDateString()] = { name: dayName, income: 0, expense: 0 }
    }
    for (const t of transactions) {
      if (t.type === 'INCOME') chartDataMap[t.date.toDateString()].income += Number(t.amount)
      if (t.type === 'EXPENSE') chartDataMap[t.date.toDateString()].expense += Number(t.amount)
    }
  } else if (timeframe === 'ALL') {
    for (const t of transactions) {
      const year = t.date.getFullYear();
      const month = t.date.toLocaleString(locale, { month: 'short' });
      const key = `${month} ${locale === 'th-TH' ? year + 543 : year}`;
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

  const incomeByCategory = Object.entries(incomeCategoryMap).map(([name, data]) => ({ name, value: data.value, color: data.color })).sort((a,b) => b.value - a.value)
  const expenseByCategory = Object.entries(expenseCategoryMap).map(([name, data]) => ({ name, value: data.value, color: data.color })).sort((a,b) => b.value - a.value)

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
    },
    paoPoints: prismaUser.paoPoints,
    lastDailyQuestAt: prismaUser.lastDailyQuestAt
  }
}
