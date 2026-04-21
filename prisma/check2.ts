import "dotenv/config"
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const incomes = await prisma.transaction.findMany({ where: { type: 'INCOME' } })
  const twenty = await prisma.transaction.findMany({ where: { type: 'EXPENSE', amount: 20 } })
  console.log("Incomes involving 875:")
  console.log(incomes.filter(t => t.amount.toString().endsWith('875')))
  console.log("Expense of 20:")
  console.log(twenty)
}
main().finally(() => prisma.$disconnect())
