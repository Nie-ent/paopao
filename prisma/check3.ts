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
  const sumIncomes = incomes.reduce((acc, t) => acc + t.amount, 0)
  console.log('Total Income:', sumIncomes)
  console.log(incomes.map(i => i.amount).sort((a, b) => a - b))
}
main().finally(() => prisma.$disconnect())
