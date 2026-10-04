"use server"

import prisma from "@/lib/db"
import { resolveLineId } from "@/lib/auth-user"
import { getUser } from "@/features/auth/actions"

const BKK_OFFSET_MS = 7 * 60 * 60 * 1000

/**
 * The form only sends a calendar day (YYYY-MM-DD, Bangkok time). Keep the time of day from
 * `timeSource` so web entries sort alongside LINE entries instead of landing at midnight.
 */
function dayWithTimeOf(dateStr: string, timeSource: Date) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const bkk = new Date(timeSource.getTime() + BKK_OFFSET_MS)
  const msOfDay = ((bkk.getUTCHours() * 60 + bkk.getUTCMinutes()) * 60 + bkk.getUTCSeconds()) * 1000 + bkk.getUTCMilliseconds()
  return new Date(Date.UTC(y, m - 1, d) + msOfDay - BKK_OFFSET_MS)
}

export async function getTransactions(options: { 
  page: number, 
  limit: number, 
  type?: 'ALL' | 'INCOME' | 'EXPENSE',
  month?: number,
  year?: number,
  sortBy?: 'DATE_DESC' | 'DATE_ASC' | 'CATEGORY',
  filterCategoryId?: string
}) {
  const { page, limit, type, month, year, sortBy, filterCategoryId } = options
  
  const user = await getUser()
  if (!user) {
    return { error: 'Unauthorized', data: [], totalPages: 0, totalItems: 0 }
  }

  // Determine LINE ID to match with Prisma
  const lineId = resolveLineId(user)

  const prismaUser = await prisma.user.findUnique({
    where: { lineId }
  })

  if (!prismaUser) {
    return { error: 'User not found', data: [], totalPages: 0, totalItems: 0 }
  }

  const skip = (page - 1) * limit

  // Define dynamic WHERE clause
  const whereClause: any = { userId: prismaUser.id }
  if (type && type !== 'ALL') {
    whereClause.type = type
  }
  
  if (year) {
    if (month && month > 0) {
      // Note: month is 1-indexed (1 = Jan, 12 = Dec)
      const startDate = new Date(year, month - 1, 1)
      const endDate = new Date(year, month, 0, 23, 59, 59, 999)
      whereClause.date = {
        gte: startDate,
        lte: endDate,
      }
    } else {
      // Entire year
      const startDate = new Date(year, 0, 1)
      const endDate = new Date(year, 11, 31, 23, 59, 59, 999)
      whereClause.date = {
        gte: startDate,
        lte: endDate,
      }
    }
  }

  if (filterCategoryId && filterCategoryId !== 'ALL') {
    whereClause.category = { name: filterCategoryId }
  }

  let orderByClause: any = { date: 'desc' }
  if (sortBy === 'DATE_ASC') {
    orderByClause = { date: 'asc' }
  } else if (sortBy === 'CATEGORY') {
    orderByClause = { category: { name: 'asc' } }
  }

  const [transactions, totalItems, allCategories] = await Promise.all([
    prisma.transaction.findMany({
      where: whereClause,
      orderBy: orderByClause,
      skip,
      take: limit,
      include: { category: true }
    }),
    prisma.transaction.count({
      where: whereClause
    }),
    prisma.category.findMany({
      where: { OR: [{ userId: null }, { userId: prismaUser.id }] }
    })
  ])

  const totalPages = Math.ceil(totalItems / limit)
  
  const parsedColors: Record<string, string> = {}
  
  allCategories.forEach(c => {
    parsedColors[c.name] = c.color
  })

  // Flatten the category object to a string for backward compatibility with frontend
  const formattedTransactions = transactions.map(t => ({
    ...t,
    categoryId: t.categoryId,
    category: (t as any).category?.name || 'Other Expense'
  }))

  return {
    data: formattedTransactions,
    totalItems,
    totalPages,
    currentPage: page,
    categoryColors: parsedColors
  }
}

export async function createTransactionServer(formData: FormData) {
  const user = await getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const lineId = resolveLineId(user)

  const prismaUser = await prisma.user.findUnique({ where: { lineId } })
  if (!prismaUser) return { success: false, error: 'User not found' }

  const amount = Number(formData.get('amount'))
  const categoryName = formData.get('category')?.toString()
  const type = formData.get('type')?.toString() || 'EXPENSE'
  const dateStr = formData.get('date')?.toString()
  const paymentMethod = formData.get('paymentMethod')?.toString() || 'Cash'
  const notes = formData.get('notes')?.toString() || ''
  const color = formData.get('color')?.toString() || '#64748b'

  if (!amount || isNaN(amount) || !dateStr || !categoryName) {
    return { success: false, error: 'Invalid required fields' }
  }

  let categoryId = ''
  try {
    let cat = await prisma.category.findFirst({
      where: {
        name: categoryName,
        OR: [{ userId: null }, { userId: prismaUser.id }]
      }
    })
    if (!cat) {
      cat = await prisma.category.create({
        data: {
          name: categoryName,
          type: type as any,
          color,
          icon: '📝',
          userId: prismaUser.id
        }
      })
    }
    categoryId = cat.id

    await prisma.transaction.create({
      data: {
        userId: prismaUser.id,
        date: dayWithTimeOf(dateStr, new Date()),
        type: type as any,
        categoryId,
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

  const lineId = resolveLineId(user)

  const prismaUser = await prisma.user.findUnique({ where: { lineId } })
  if (!prismaUser) return { success: false, error: 'User not found' }

  const amount = Number(formData.get('amount'))
  const categoryName = formData.get('category')?.toString()
  const type = formData.get('type')?.toString() || 'EXPENSE'
  const dateStr = formData.get('date')?.toString()
  const paymentMethod = formData.get('paymentMethod')?.toString() || 'Cash'
  const notes = formData.get('notes')?.toString() || ''
  const color = formData.get('color')?.toString() || '#64748b'

  if (!amount || isNaN(amount) || !dateStr || !categoryName) {
    return { success: false, error: 'Invalid required fields' }
  }

  try {
    const existing = await prisma.transaction.findFirst({ where: { id, userId: prismaUser.id } })
    if (!existing) return { success: false, error: 'Transaction not found' }

    let categoryId = ''
    let cat = await prisma.category.findFirst({
      where: {
        name: categoryName,
        OR: [{ userId: null }, { userId: prismaUser.id }]
      }
    })
    if (!cat) {
      cat = await prisma.category.create({
        data: {
          name: categoryName,
          type: type as any,
          color,
          icon: '📝',
          userId: prismaUser.id
        }
      })
    }
    categoryId = cat.id

    await prisma.transaction.update({
      where: { id, userId: prismaUser.id },
      data: {
        date: dayWithTimeOf(dateStr, existing.date),
        type: type as any,
        categoryId,
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

  const lineId = resolveLineId(user)

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
