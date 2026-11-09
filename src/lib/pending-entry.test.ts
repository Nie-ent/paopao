import { describe, expect, it } from "vitest"
import { categoryChoices, editItem, encodeEntryAction, parseDraftItems, parseEntryAction, typeForCategory, type EntryAction } from "./pending-entry"

const id = "3bfdc40d-2881-47b7-a31e-85e9897df35a"

describe("entry postbacks", () => {
  it("round-trips every action within LINE's 300-character limit", () => {
    const actions: EntryAction[] = [
      { action: "save", draftId: id }, { action: "cancel", draftId: id },
      { action: "amount", draftId: id, index: 2 }, { action: "pickCategory", draftId: id, index: 0 },
      { action: "flipType", draftId: id, index: 1 },
      { action: "setCategory", draftId: id, index: 0, category: "Debt Payment" },
      { action: "setCategory", draftId: id, index: 3, category: "หนี้บัตร | ร้าน A" },
    ]
    for (const a of actions) {
      const data = encodeEntryAction(a)
      expect(data.length).toBeLessThanOrEqual(300)
      expect(parseEntryAction(data)).toEqual(a)
    }
  })
  it("rejects other postbacks and malformed data", () => {
    for (const d of ["summary|DAY", "entry|save", "entry|save|x", `entry|amount|${id}`, `entry|amount|${id}|-1`, `entry|setCategory|${id}|0|`, `entry|delete|${id}`, `entry|save|${id}|0`]) {
      expect(parseEntryAction(d), d).toBeNull()
    }
  })
})

describe("draft helpers", () => {
  it("offers the user's own categories first, without the current one, max 13, Other last", () => {
    const c = categoryChoices("EXPENSE", ["หนี้บัตร", "Food"], "Food")
    expect(c[0]).toBe("หนี้บัตร")
    expect(c).not.toContain("Food")
    expect(c).toContain("Debt Payment")
    expect(c.length).toBeLessThanOrEqual(13)
    expect(c.at(-1)).toBe("Other Expense")
    expect(categoryChoices("INCOME", [], "Salary")).not.toContain("Food")
  })
  it("a built-in category decides income vs expense", () => {
    expect(typeForCategory("Salary", "EXPENSE")).toBe("INCOME")
    expect(typeForCategory("Debt Payment", "INCOME")).toBe("EXPENSE")
    expect(typeForCategory("ของฉัน", "INCOME")).toBe("INCOME")
  })
  it("edits one item and validates stored JSON", () => {
    const items = [{ type: "EXPENSE" as const, amount: 65, category: "Food", note: "กาแฟ" }]
    expect(editItem(items, 0, { amount: 80 })![0].amount).toBe(80)
    expect(items[0].amount).toBe(65)
    expect(editItem(items, 1, { amount: 80 })).toBeNull()
    expect(parseDraftItems([...items, { type: "X", amount: 1, category: "a" }, { type: "INCOME", amount: 0, category: "a" }, null])).toEqual(items)
    expect(parseDraftItems("nope")).toEqual([])
  })
})
