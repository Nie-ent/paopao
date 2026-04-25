"use server"

import prisma from "@/lib/db"
import { getUser } from "@/features/auth/actions"

export async function getTransactions(options: { 
  page: number, 
  limit: number, 
  type?: 'ALL' | 'INCOME' | 'EXPENSE',
  month?: number,
  year?: number,
  sortBy?: 'DATE_DESC' | 'DATE_ASC' | 'CATEGORY',
  filterCategory?: string
}) {
  const { page, limit, type, month, year, sortBy, filterCategory } = options
  
  const user = await getUser()
  if (!user) {
    return { error: 'Unauthorized', data: [], totalPages: 0, totalItems: 0 }
  }

  // Determine LINE ID to match with Prisma
  let lineId = "U9f4477a859862ce8589b09e879ec068c"
  if (user.app_metadata?.provider === "line") {
    lineId = (user as any).user_metadata.provider_id
  }

  const prismaUser = await prisma.user.findUnique({
    where: { lineId }
  })

  if (!prismaUser) {
    return { error: 'User not found', data: [], totalPages: 0, totalItems: 0, categoryColors: {} }
  }

  const skip = (page - 1) * limit

  // Define dynamic WHERE clause
  const whereClause: any = { userId: prismaUser.id }
  if (type && type !== 'ALL') {
    whereClause.type = type
  }
  
  if (month && year) {
    // Note: month is 1-indexed (1 = Jan, 12 = Dec)
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59, 999)
    whereClause.date = {
      gte: startDate,
      lte: endDate,
    }
  }

  if (filterCategory && filterCategory !== 'ALL') {
    whereClause.category = filterCategory
  }

  let orderByClause: any = { date: 'desc' }
  if (sortBy === 'DATE_ASC') {
    orderByClause = { date: 'asc' }
  } else if (sortBy === 'CATEGORY') {
    orderByClause = { category: 'asc' }
  }

  const [transactions, totalItems] = await Promise.all([
    prisma.transaction.findMany({
      where: whereClause,
      orderBy: orderByClause,
      skip,
      take: limit,
    }),
    prisma.transaction.count({
      where: whereClause
    })
  ])

  const totalPages = Math.ceil(totalItems / limit)
  
  let parsedColors = {}
  try {
    if (prismaUser.categoryColors) {
      parsedColors = JSON.parse(prismaUser.categoryColors)
    }
  } catch (e) {}

  return {
    data: transactions,
    totalItems,
    totalPages,
    currentPage: page,
    categoryColors: parsedColors
  }
}

export async function createTransactionServer(formData: FormData) {
  const user = await getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  let lineId = "U9f4477a859862ce8589b09e879ec068c"
  if (user.app_metadata?.provider === "line") {
    lineId = (user as any).user_metadata.provider_id
  }

  const prismaUser = await prisma.user.findUnique({ where: { lineId } })
  if (!prismaUser) return { success: false, error: 'User not found' }

  const amount = Number(formData.get('amount'))
  const category = formData.get('category')?.toString() || 'Other'
  const type = formData.get('type')?.toString() || 'EXPENSE'
  const dateStr = formData.get('date')?.toString()
  const paymentMethod = formData.get('paymentMethod')?.toString() || 'Cash'
  const notes = formData.get('notes')?.toString() || ''

  if (!amount || isNaN(amount) || !dateStr) {
    return { success: false, error: 'Invalid required fields' }
  }

  try {
    await prisma.transaction.create({
      data: {
        userId: prismaUser.id,
        date: new Date(dateStr),
        type,
        category,
        amount,
        note: formData.get('notes')?.toString() || ''
      }
    })
    return { success: true }
  } catch (error) {
    console.error(error)
    return { success: false, error: 'Database Error' }
  }
}

export async function updateTransactionServer(id: string, formData: FormData) {
  const user = await getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const amount = Number(formData.get('amount'))
  const category = formData.get('category')?.toString() || 'Other'
  const type = formData.get('type')?.toString() || 'EXPENSE'
  const dateStr = formData.get('date')?.toString()
  const paymentMethod = formData.get('paymentMethod')?.toString() || 'Cash'
  const notes = formData.get('notes')?.toString() || ''

  if (!amount || isNaN(amount) || !dateStr) {
    return { success: false, error: 'Invalid required fields' }
  }

  try {
    await prisma.transaction.update({
      where: { id },
      data: {
        date: new Date(dateStr),
        type,
        category,
        amount,
        note: formData.get('notes')?.toString() || ''
      }
    })
    return { success: true }
  } catch (error) {
    console.error(error)
    return { success: false, error: 'Database Error' }
  }
}

export async function deleteTransactionServer(id: string) {
  const user = await getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  let lineId = "U9f4477a859862ce8589b09e879ec068c"
  if (user.app_metadata?.provider === "line") {
    lineId = (user as any).user_metadata.provider_id
  }

  const prismaUser = await prisma.user.findUnique({ where: { lineId } })
  if (!prismaUser) return { success: false, error: 'User not found' }

  try {
    await prisma.transaction.delete({
      where: { id, userId: prismaUser.id }
    })
    return { success: true }
  } catch (error) {
    console.error(error)
    return { success: false, error: 'Database Error' }
  }
}
