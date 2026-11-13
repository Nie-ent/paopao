"use server"

import prisma from "@/lib/db"
import { getCurrentUser } from "@/lib/current-user"
import { bangkokDate, bangkokMonthRange, dayWithTimeOf } from "@/lib/dates"
import { z } from "zod"
import { FALLBACK_CATEGORY } from "@/lib/categories"
import { statementRowTimestamp } from "@/lib/statement"
import { normalizeReference } from "@/lib/slip"
import { MAX_AMOUNT } from "@/lib/money"
import { trackFeature } from "@/lib/feature-events"


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
    // Month is 1-indexed (1 = Jan); 0 or missing means the whole year. Bangkok calendar.
    whereClause.date = month && month > 0
      ? bangkokMonthRange(year, month - 1)
      : { gte: bangkokDate(year, 0, 1), lt: bangkokDate(year + 1, 0, 1) }
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

const MAX_CUSTOM_CATEGORIES = 50

const transactionFormSchema = z.object({
  amount: z.coerce.number().positive().max(MAX_AMOUNT),
  type: z.enum(['INCOME', 'EXPENSE']).default('EXPENSE'),
  category: z.string().trim().min(1).max(40),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(200).default(''),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#64748b'),
})

/** Reads and validates the add/edit transaction form. */
function parseTransactionForm(formData: FormData) {
  const field = (name: string) => formData.get(name)?.toString() || undefined
  return transactionFormSchema.safeParse({
    amount: field('amount'), type: field('type'), category: field('category'),
    date: field('date'), notes: field('notes'), color: field('color'),
  })
}

/** The category with this name (built-in or the user's own), creating a custom one if needed. */
async function findOrCreateCategory(userId: string, name: string, type: 'INCOME' | 'EXPENSE', color: string) {
  const existing = await prisma.category.findFirst({ where: { name, OR: [{ userId: null }, { userId }] } })
  if (existing) return existing
  if (await prisma.category.count({ where: { userId } }) >= MAX_CUSTOM_CATEGORIES) return null
  return prisma.category.create({ data: { name, type, color, icon: '📝', userId } })
}

export async function createTransactionServer(formData: FormData) {
  const prismaUser = await getCurrentUser()
  if (!prismaUser) return { success: false, error: 'User not found' }

  const parsed = parseTransactionForm(formData)
  if (!parsed.success) return { success: false, error: 'Invalid required fields' }
  const { amount, type, category, date, notes, color } = parsed.data

  try {
    const cat = await findOrCreateCategory(prismaUser.id, category, type, color)
    if (!cat) return { success: false, error: 'Too many categories' }

    await prisma.transaction.create({
      data: {
        userId: prismaUser.id,
        date: dayWithTimeOf(date, new Date()),
        type,
        categoryId: cat.id,
        amount,
        note: notes
      }
    })
    await trackFeature("web_entry", { source: "web", userId: prismaUser.id })
    return { success: true }
  } catch (error) {
    console.error(error)
    return { success: false, error: 'Database Error' }
  }
}

export async function updateTransactionServer(id: string, formData: FormData) {
  const prismaUser = await getCurrentUser()
  if (!prismaUser) return { success: false, error: 'User not found' }

  const parsed = parseTransactionForm(formData)
  if (!parsed.success) return { success: false, error: 'Invalid required fields' }
  const { amount, type, category, date, notes, color } = parsed.data

  try {
    const existing = await prisma.transaction.findFirst({ where: { id, userId: prismaUser.id } })
    if (!existing) return { success: false, error: 'Transaction not found' }

    const cat = await findOrCreateCategory(prismaUser.id, category, type, color)
    if (!cat) return { success: false, error: 'Too many categories' }

    await prisma.transaction.update({
      where: { id, userId: prismaUser.id },
      data: {
        date: dayWithTimeOf(date, existing.date),
        type,
        categoryId: cat.id,
        amount,
        note: notes
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
    const { count } = await prisma.transaction.deleteMany({
      where: { id, userId: prismaUser.id }
    })
    return count ? { success: true } : { success: false, error: 'Transaction not found' }
  } catch (error) {
    console.error(error)
    return { success: false, error: 'Database Error' }
  }
}

const statementRowsSchema = z.array(z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.number().positive().max(MAX_AMOUNT),
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
  await trackFeature("web_statement", { source: "web", userId: user.id })
  return { success: true as const, imported: count, skipped: parsed.data.length - count }
}
