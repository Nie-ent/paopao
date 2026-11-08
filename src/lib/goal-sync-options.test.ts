import { describe, expect, it } from "vitest"
import { goalSyncCategories } from "./goal-sync-options"

describe("goalSyncCategories", () => {
  it("offers every built-in category, goal-like ones first, plus the user's own", () => {
    const o = goalSyncCategories(["Food", "Debt Payment", "หนี้บัตรเครดิต", "ค่าเทอมลูก", "หนี้บัตรเครดิต"])
    expect(o.expense.slice(0, 3)).toEqual(["Debt Payment", "Saving", "Investment"])
    expect(o.expense).toContain("Food")
    expect(new Set(o.expense).size).toBe(o.expense.length)
    expect(o.income).toContain("Salary")
    expect(o.custom).toEqual(["ค่าเทอมลูก", "หนี้บัตรเครดิต"].sort((a, b) => a.localeCompare(b)))
  })
})
