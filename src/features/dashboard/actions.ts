"use server"

import prisma from "@/lib/db"
import { Prisma } from "@prisma/client"
import { getCurrentUser } from "@/lib/current-user"
import { bangkokDate, bangkokDayKey, bangkokMonthRange, bangkokParts } from "@/lib/dates"
import { roundMoney } from '@/lib/money'

const BKK = "Asia/Bangkok"

export async function getDashboardData(timeframe: 'ALL' | 'YTD' | 'MONTH' | 'WEEK' = 'MONTH', selectedMonth?: number, selectedYear?: number, locale: 'th-TH' | 'en-US' = 'en-US') {
  const prismaUser = await getCurrentUser()
  if (!prismaUser) return { error: "User not found" }

  // All calendar math is in Bangkok time; the server runs in UTC
  const today = bangkokParts(new Date())
  const y = selectedYear || today.year
  const m = selectedMonth ? selectedMonth - 1 : today.month
  let dateFilter: { gte: Date; lt?: Date } | null = null

  if (timeframe === 'YTD') {
    dateFilter = { gte: bangkokDate(today.year, 0, 1) }
  } else if (timeframe === 'MONTH') {
    dateFilter = bangkokMonthRange(y, m)
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
    const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
    
    for (let i = 1; i <= daysInMonth; i++) {
      chartDataMap[i.toString()] = { name: i.toString(), income: 0, expense: 0 }
    }
    for (const t of transactions) {
      const d = bangkokParts(t.date).day.toString()
      if (chartDataMap[d]) {
        if (t.type === 'INCOME') chartDataMap[d].income += Number(t.amount)
        if (t.type === 'EXPENSE') chartDataMap[d].expense += Number(t.amount)
      }
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

  return {
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
