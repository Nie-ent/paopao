/**
 * The money picture the AI gets, against a real database. Skipped unless TEST_DATABASE_URL points
 * at a throwaway database with the migrations applied:
 *   TEST_DATABASE_URL=postgresql://… npx vitest run src/lib/finance-context.int.test.ts
 */
import { beforeAll, describe, expect, it, vi } from "vitest"

const url = process.env.TEST_DATABASE_URL

describe.skipIf(!url)("finance context for the AI (database)", () => {
  let prisma: typeof import("./db").default, financeContext: typeof import("./finance-context").financeContext
  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", url!)
    prisma = (await import("./db")).default
    financeContext = (await import("./finance-context")).financeContext
  })

  it("includes this month, fixed costs vs. income and goals", async () => {
    const user = await prisma.user.upsert({ where: { lineId: "Ufinctx" }, create: { lineId: "Ufinctx" }, update: {} })
    await prisma.recurringBill.deleteMany({ where: { userId: user.id } })
    await prisma.goal.deleteMany({ where: { userId: user.id } })
    await prisma.transaction.deleteMany({ where: { userId: user.id } })
    const salary = await prisma.category.findFirstOrThrow({ where: { name: "Salary", userId: null } })
    const food = await prisma.category.findFirstOrThrow({ where: { name: "Food", userId: null } })
    const now = new Date()
    await prisma.transaction.createMany({ data: [
      { userId: user.id, type: "INCOME", amount: 30000, categoryId: salary.id, date: now },
      { userId: user.id, type: "EXPENSE", amount: 120, categoryId: food.id, date: now, note: "ข้าว" },
    ] })
    await prisma.recurringBill.createMany({ data: [
      { userId: user.id, name: "ค่าเช่า", category: "Housing", amount: 9000, frequency: "MONTHLY", dayOfMonth: 1 },
      { userId: user.id, name: "Netflix", category: "Entertainment", amount: 419, frequency: "MONTHLY", dayOfMonth: 5, essential: false },
    ] })
    await prisma.goal.create({ data: { userId: user.id, title: "เงินฉุกเฉิน", targetAmount: 50000 } })

    const th = await financeContext(user.id, "th", now)
    expect(th).toContain("รายรับ ฿30,000")
    expect(th).toContain("ค่าใช้จ่ายคงที่ต่อเดือน: ฿9,419")
    expect(th).toContain("Netflix ฿419 (ตัดได้)")
    expect(th).toContain("เหลือเงินใช้ได้หลังหักค่าใช้จ่ายคงที่ ฿20,581")
    expect(th).toContain("เงินฉุกเฉิน ฿0/฿50,000")
    expect(await financeContext(user.id, "en", now)).toContain("Fixed costs per month: ฿9,419")
  })
})
