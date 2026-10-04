"use server"

import prisma from "@/lib/db"
import { getCurrentUser } from "@/lib/current-user"
import { dayWithTimeOf } from "@/lib/dates"
import { z } from "zod"
import { FALLBACK_CATEGORY } from "@/lib/categories"
import { statementRowTimestamp } from "@/lib/statement"
import { normalizeReference } from "@/lib/slip"


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
  
  const prismaUser = await getCurrentUser()
  if (!prismaUser) {
    return { error: 'Unauthorized', data: [], totalPages: 0, totalItems: 0 }
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
  const prismaUser = await getCurrentUser()
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
  const prismaUser = await getCurrentUser()
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
  const prismaUser = await getCurrentUser()
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

const statementRowsSchema = z.array(z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.number().positive().max(100_000_000),
  category: z.string().min(1).max(60),
  note: z.string().max(200),
  reference: z.string().max(64).nullish(),
})).min(1).max(1000)

/** Saves the statement rows the user kept in the preview. Rows whose bank reference is already recorded are skipped. */
export async function importStatementRows(input: unknown) {
  const user = await getCurrentUser()
  if (!user) return { success: false as const, error: 'Unauthorized' }

  const parsed = statementRowsSchema.safeParse(input)
  if (!parsed.success) return { success: false as const, error: 'Invalid rows' }

  const categories = await prisma.category.findMany({ where: { OR: [{ userId: null }, { userId: user.id }] } })
  const categoryId = (name: string, type: 'INCOME' | 'EXPENSE') =>
    (categories.find(c => c.name === name) ?? categories.find(c => c.name === FALLBACK_CATEGORY[type]))!.id

  const { count } = await prisma.transaction.createMany({
    data: parsed.data.map(row => ({
      userId: user.id,
      type: row.type,
      amount: row.amount,
      categoryId: categoryId(row.category, row.type),
      note: row.note,
      date: statementRowTimestamp(row),
      reference: normalizeReference(row.reference),
    })),
    skipDuplicates: true, // unique (userId, reference)
  })
  return { success: true as const, imported: count, skipped: parsed.data.length - count }
}
