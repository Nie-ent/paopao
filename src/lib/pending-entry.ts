/**
 * Confirm-before-save for entries read from LINE messages. The bot reads "กาแฟ 65" (or a slip),
 * keeps it as a draft and shows a card: confirm, change the amount, change the category or cancel.
 * Only "confirm" writes transactions. Pure helpers; the database side lives in line.service.
 */
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/categories"
import { isValidAmount } from "@/lib/money"

export type DraftItem = {
  type: "INCOME" | "EXPENSE"
  amount: number
  category: string
  note: string | null
  reference?: string | null
  slipHash?: string | null
}

/** A draft not confirmed within this time is dropped */
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000
/** Items that get their own edit buttons on the card (more would make it too long) */
export const EDITABLE_ITEMS = 5

export type EntryAction =
  | { action: "save"; draftId: string }
  | { action: "cancel"; draftId: string }
  | { action: "amount"; draftId: string; index: number }
  | { action: "pickCategory"; draftId: string; index: number }
  | { action: "setCategory"; draftId: string; index: number; category: string }
  | { action: "flipType"; draftId: string; index: number }

// Postback data is limited to 300 characters; a draft id (36) plus a category name fits easily
export function encodeEntryAction(a: EntryAction): string {
  switch (a.action) {
    case "save": case "cancel": return `entry|${a.action}|${a.draftId}`
    case "amount": case "pickCategory": case "flipType": return `entry|${a.action}|${a.draftId}|${a.index}`
    case "setCategory": return `entry|setCategory|${a.draftId}|${a.index}|${a.category}`
  }
}

export function parseEntryAction(data: string): EntryAction | null {
  const [tag, action, draftId, rawIndex, ...rest] = data.split("|")
  if (tag !== "entry" || !draftId || !/^[\w-]{8,64}$/.test(draftId)) return null
  if ((action === "save" || action === "cancel") && rawIndex === undefined) return { action, draftId }
  const index = Number(rawIndex)
  if (!Number.isInteger(index) || index < 0 || index > 50) return null
  if ((action === "amount" || action === "pickCategory" || action === "flipType") && rest.length === 0) return { action, draftId, index }
  if (action === "setCategory" && rest.length > 0) {
    const category = rest.join("|").trim()
    return category ? { action, draftId, index, category } : null
  }
  return null
}

// Most-used first, so the common fixes fit in LINE's 13 quick-reply buttons
const EXPENSE_ORDER = ["Food", "Groceries", "Transport", "Shopping", "Utilities", "Housing", "Debt Payment", "Saving",
  "Investment", "Health & Medical", "Entertainment", "Family & Pets", "Personal Care", "Education", "Gift & Donation", "Transfer Out"]

/**
 * Categories offered when changing an item's category (a LINE quick reply holds 13 buttons):
 * the user's own categories of any type first, then built-in ones of the item's type.
 */
export function categoryChoices(type: DraftItem["type"], userCategories: string[], current: string, max = 13): string[] {
  const fallback = type === "INCOME" ? "Other Income" : "Other Expense"
  const builtIn = type === "INCOME" ? INCOME_CATEGORIES.filter(c => c !== fallback) : EXPENSE_ORDER.filter(c => EXPENSE_CATEGORIES.includes(c))
  const all = [...userCategories.filter(c => !EXPENSE_CATEGORIES.includes(c) && !INCOME_CATEGORIES.includes(c)), ...builtIn]
  // "Other" always stays as the last button
  return [...[...new Set(all)].filter(c => c !== current && c !== fallback).slice(0, max - 1), ...(current === fallback ? [] : [fallback])]
}

/** Which way money goes for a category: built-in categories decide, the user's own keep the item's type */
export function typeForCategory(category: string, fallback: DraftItem["type"]): DraftItem["type"] {
  if (INCOME_CATEGORIES.includes(category)) return "INCOME"
  if (EXPENSE_CATEGORIES.includes(category)) return "EXPENSE"
  return fallback
}

/** Applies an edit to a copy of the items; null when the index is out of range */
export function editItem(items: DraftItem[], index: number, patch: Partial<DraftItem>): DraftItem[] | null {
  if (!items[index]) return null
  return items.map((it, i) => (i === index ? { ...it, ...patch } : it))
}

/** Reads the stored JSON back, dropping anything malformed */
export function parseDraftItems(json: unknown): DraftItem[] {
  if (!Array.isArray(json)) return []
  return json.filter((x): x is DraftItem =>
    !!x && typeof x === "object" && (x.type === "INCOME" || x.type === "EXPENSE") &&
    isValidAmount(x.amount) && typeof x.category === "string")
}
