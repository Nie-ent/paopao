import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { decryptDeep, encryptArgs } from '@/lib/field-crypto'

/**
 * The app's Prisma client. Free-text columns (src/lib/field-crypto.ts) are encrypted on write
 * and decrypted on read here, including inside interactive transactions.
 */
const prismaClientSingleton = () => {
  const connectionString = process.env.DATABASE_URL
  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter }).$extends({
    query: {
      $allModels: {
        async $allOperations({ model, args, query }) {
          return decryptDeep(await query(encryptArgs(model, args) as typeof args))
        },
      },
    },
  })
}

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma
