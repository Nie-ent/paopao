/** Server only: turns Prisma Decimal values in query results into numbers (see src/lib/money.ts). */
import { Prisma } from "@prisma/client"

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== "object") return false
  const proto = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

/** Replaces every Prisma Decimal in a query result (any nesting, aggregates included) with a number. */
export function decimalsToNumbers<T>(value: T): T {
  if (Prisma.Decimal.isDecimal(value)) return (value as unknown as Prisma.Decimal).toNumber() as T
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = decimalsToNumbers(value[i])
    return value
  }
  if (isPlainObject(value)) {
    const obj = value as Record<string, unknown>
    for (const k of Object.keys(obj)) obj[k] = decimalsToNumbers(obj[k])
  }
  return value
}
