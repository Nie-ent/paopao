import "dotenv/config"
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const incomes = await prisma.transaction.aggregate({ where: { type: 'INCOME' }, _sum: { amount: true }, _count: true })
  console.log('Total Income:', incomes._sum.amount, 'Count:', incomes._count)
  const expenses = await prisma.transaction.aggregate({ where: { type: 'EXPENSE' }, _sum: { amount: true }, _count: true })
  console.log('Total Expense:', expenses._sum.amount, 'Count:', expenses._count)
}
main().finally(() => prisma.$disconnect())
