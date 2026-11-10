import { describe, expect, it } from "vitest"
import { applyCaption, captionTarget, categoryChoices, editItem, encodeEntryAction, isCaptionText, parseDraftItems, parseEntryAction, typeForCategory, type DraftItem, type EntryAction } from "./pending-entry"

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

describe("slip captions", () => {
  const slip: DraftItem = { type: "EXPENSE", amount: 120, category: "Transfer Out", note: "โอนเงินให้ น.ส. ก", reference: "016313224002ATF04414", slipHash: "h1" }
  const typed: DraftItem = { type: "EXPENSE", amount: 65, category: "Food", note: "กาแฟ" }

  it("treats short text without numbers as a caption", () => {
    expect(isCaptionText("ค่าบะหมี่")).toBe(true)
    expect(isCaptionText("ข้าว 60")).toBe(false)
    expect(isCaptionText("  ")).toBe(false)
    expect(isCaptionText("ก".repeat(61))).toBe(false)
  })

  it("notes the latest slip and takes the caption's category", () => {
    const out = applyCaption([slip, typed], "ค่าบะหมี่", { type: "EXPENSE", category: "Food" })!
    expect(out[0]).toMatchObject({ note: "ค่าบะหมี่ · โอนเงินให้ น.ส. ก", category: "Food", amount: 120 })
    expect(out[1]).toEqual(typed)
  })

  it("keeps the category when the caption names none or the other direction", () => {
    expect(applyCaption([slip], "ของฝาก", null)![0].category).toBe("Transfer Out")
    expect(applyCaption([slip], "เงินเดือน", { type: "INCOME", category: "Salary" })![0].category).toBe("Transfer Out")
    expect(applyCaption([{ ...slip, note: null }], "ค่าบะหมี่", null)![0].note).toBe("ค่าบะหมี่")
  })

  it("has nothing to caption without a slip", () => {
    expect(captionTarget([typed])).toBe(-1)
    expect(applyCaption([typed], "ค่าบะหมี่", null)).toBeNull()
  })
})
