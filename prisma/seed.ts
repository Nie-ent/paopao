import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Start seeding...')

  // Create a mock user
  const user = await prisma.user.upsert({
    where: { lineId: 'mock-line-id-user-1' },
    update: {},
    create: {
      lineId: 'mock-line-id-user-1',
      name: 'Test User',
      transactions: {
        create: [
          {
            type: 'INCOME',
            amount: 50000,
            category: 'Salary',
            note: 'เดือนมกราคม',
            date: new Date(),
          },
          {
            type: 'EXPENSE',
            amount: 150,
            category: 'Food',
            note: 'ข้าวผัดกะเพรา',
            date: new Date(),
          },
        ],
      },
      goals: {
        create: [
          {
            title: 'DCA Portfolio',
            targetAmount: 100000,
            currentAmount: 10000,
            deadline: new Date('2025-12-31'),
          },
        ],
      },
    },
  })

  console.log(`Seeding finished. User created with id: ${user.id}`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
