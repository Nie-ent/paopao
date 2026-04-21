import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const lineId = "U9f4477a859862ce8589b09e879ec068c"
  const user = await prisma.user.findUnique({ where: { lineId } })
  console.log("USER:", user)
  if (user) {
    const txs = await prisma.transaction.findMany({ where: { userId: user.id }, orderBy: { date: 'desc' } })
    console.log("TXS:", txs.map(t => ({ id: t.id, type: t.type, amount: t.amount, category: t.category, date: t.date })))
  }
}
main()
