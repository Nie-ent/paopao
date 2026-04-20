import "dotenv/config"
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Cleaning up duplicate identities (demo, demo_line_id)...')

  const usersToDelete = await prisma.user.findMany({
    where: {
      lineId: {
        in: ['demo', 'demo_line_id']
      }
    }
  })

  for (const user of usersToDelete) {
    await prisma.transaction.deleteMany({ where: { userId: user.id } })
    await prisma.goal.deleteMany({ where: { userId: user.id } })
    await prisma.user.delete({ where: { id: user.id } })
    console.log(`Deleted user and transactions for lineId: ${user.lineId}`)
  }

  console.log('Cleanup complete! Now there is only ONE single user instance containing the 173 transactions.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
