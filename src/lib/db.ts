import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { decryptDeep, encryptArgs } from '@/lib/field-crypto'
import { decimalsToNumbers } from '@/lib/money-db'

/** Money columns (Decimal in the database) are read as numbers: see src/lib/money.ts */
const asNumber = <K extends string>(field: K) => ({ needs: { [field]: true } as Record<K, true>, compute: (r: Record<K, unknown>) => Number(r[field]) })
const asNumberOrNull = <K extends string>(field: K) => ({ needs: { [field]: true } as Record<K, true>, compute: (r: Record<K, unknown>) => (r[field] == null ? null : Number(r[field])) })

/**
 * The app's Prisma client. Here, for every query (inside interactive transactions too):
 * - free-text columns (src/lib/field-crypto.ts) are encrypted on write and decrypted on read;
 * - Decimal money values become plain numbers (src/lib/money.ts), aggregates included.
 */
const prismaClientSingleton = () => {
  const connectionString = process.env.DATABASE_URL
  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
    .$extends({
      query: {
        $allModels: {
          async $allOperations({ model, args, query }) {
            return decimalsToNumbers(decryptDeep(await query(encryptArgs(model, args) as typeof args)))
          },
        },
      },
    })
    // Types only: the query extension above already converted the values
    .$extends({
      result: {
        transaction: { amount: asNumber('amount') },
        subscriptionPayment: { amount: asNumber('amount') },
        goal: { targetAmount: asNumber('targetAmount'), currentAmount: asNumber('currentAmount') },
        recurringBill: { amount: asNumberOrNull('amount') },
        groupBill: { serviceCharge: asNumber('serviceCharge'), vat: asNumber('vat'), discount: asNumber('discount'), printedTotal: asNumberOrNull('printedTotal') },
        groupBillItem: { amount: asNumber('amount'), discount: asNumber('discount') },
        groupDebt: { amount: asNumber('amount') },
      },
    })
}

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma
