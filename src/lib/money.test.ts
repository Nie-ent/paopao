import { describe, expect, it } from "vitest"
import { Prisma } from "@prisma/client"
import { isValidAmount, MAX_AMOUNT, roundMoney, sumMoney } from "./money"
import { decimalsToNumbers } from "./money-db"

describe("money", () => {
  it("rounds float sums to the satang", () => {
    expect(0.1 + 0.2).not.toBe(0.3)
    expect(sumMoney([0.1, 0.2])).toBe(0.3)
    expect(roundMoney(1.005)).toBe(1.01)
    expect(roundMoney(-2.675)).toBe(-2.67)
    expect(sumMoney(Array(1000).fill(19.99))).toBe(19990)
  })

  it("accepts only positive amounts up to the limit", () => {
    expect(isValidAmount(0.01)).toBe(true)
    expect(isValidAmount(MAX_AMOUNT)).toBe(true)
    for (const bad of [0, -1, MAX_AMOUNT + 1, NaN, Infinity, "65", null]) expect(isValidAmount(bad), String(bad)).toBe(false)
  })

  it("turns Decimals anywhere in a result into numbers", () => {
    const when = new Date()
    const out = decimalsToNumbers({
      amount: new Prisma.Decimal("12.34"),
      _sum: { amount: new Prisma.Decimal("0.30") },
      user: { transactions: [{ amount: new Prisma.Decimal("65.00"), date: when }] },
      none: null,
    })
    expect(out).toEqual({ amount: 12.34, _sum: { amount: 0.3 }, user: { transactions: [{ amount: 65, date: when }] }, none: null })
    expect(out.user.transactions[0].date).toBe(when)
  })
})
