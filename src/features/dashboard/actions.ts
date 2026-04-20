"use server"

import prisma from "@/lib/db"
import { getUser } from "@/features/auth/actions"

export async function getDashboardData(timeframe: 'YTD' | 'MONTH' | 'WEEK' = 'MONTH') {
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

  const transactions = await prisma.transaction.findMany({
    where: {
      userId: prismaUser.id,
      date: { gte: startDate }
    },
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
  }


  // All time Totals and Breakdown
  const allTransactions = await prisma.transaction.findMany({
    where: { userId: prismaUser.id },
  })

  let lifetimeIncome = 0
  let lifetimeExpense = 0
  const incomeCategoryMap: Record<string, number> = {}
  const expenseCategoryMap: Record<string, number> = {}

  for (const agg of allTransactions) {
    const amt = Number(agg.amount)
    if (agg.type === 'INCOME') {
      lifetimeIncome += amt
      incomeCategoryMap[agg.category || 'Other'] = (incomeCategoryMap[agg.category || 'Other'] || 0) + amt
    }
    if (agg.type === 'EXPENSE') {
      lifetimeExpense += amt
      expenseCategoryMap[agg.category || 'Other'] = (expenseCategoryMap[agg.category || 'Other'] || 0) + amt
    }
  }

  const incomeByCategory = Object.entries(incomeCategoryMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value)
  const expenseByCategory = Object.entries(expenseCategoryMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value)

  return {
    chartData: Object.values(chartDataMap),
    incomeByCategory,
    expenseByCategory,
    stats: {
      totalBalance: lifetimeIncome - lifetimeExpense,
      totalIncome: lifetimeIncome,
      totalExpense: lifetimeExpense,
    }
  }
}
