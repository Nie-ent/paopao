import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", () => ({ default: {} }))
const { goalProgressWhere } = await import("./goal-progress")

const goal = (trackCategory: string | null, deadline: string | null = "2026-12-31T00:00:00Z") => ({
  userId: "u1",
  trackCategory,
  // 01:00 Bangkok on 1 Nov (still 31 Oct in UTC)
  createdAt: new Date("2026-10-31T18:00:00Z"),
  deadline: deadline ? new Date(deadline) : null,
})

describe("goalProgressWhere", () => {
  it("is null for manually tracked goals", () => {
    expect(goalProgressWhere(goal(null))).toBeNull()
  })

  it("'Income' and 'Expense' sum by transaction type, not a category named Income", () => {
    expect(goalProgressWhere(goal("Income"))).toMatchObject({ type: "INCOME" })
    expect(goalProgressWhere(goal("Expense"))).toMatchObject({ type: "EXPENSE" })
    expect(goalProgressWhere(goal("Income"))).not.toHaveProperty("category")
  })

  it("other values filter by category name", () => {
    expect(goalProgressWhere(goal("Saving"))).toMatchObject({ category: { name: "Saving" } })
  })

  it("counts from the Bangkok month the goal was created through the end of the deadline day", () => {
    const where = goalProgressWhere(goal("Saving"))!
    expect(where.date).toEqual({ gte: new Date("2026-10-31T17:00:00Z"), lt: new Date("2026-12-31T17:00:00Z") })
  })

  it("has no upper bound without a deadline", () => {
    expect((goalProgressWhere(goal("Saving", null))!.date as { lt?: Date }).lt).toBeUndefined()
  })

  it("daily balance covers only the Bangkok day of asOf", () => {
    const where = goalProgressWhere(goal("DAILY_BALANCE"), new Date("2026-11-08T23:30:00Z"))!
    expect(where.date).toEqual({ gte: new Date("2026-11-08T17:00:00Z"), lt: new Date("2026-11-09T17:00:00Z") })
  })
})
