import "dotenv/config"
import prisma from "../src/lib/db"
import { CATEGORIES } from "../src/lib/categories"

// Creates the built-in (userId = null) categories that are missing. Safe to run again: it never
// changes or deletes existing rows. Usage: npx tsx prisma/seed-categories.ts
const ICONS: Record<string, string> = {
  Salary: "💰", Freelance: "💻", Business: "🏢", "Investment Income": "📈", Gift: "🎁", "Transfer In": "📥", "Other Income": "💵",
  Food: "🍔", Groceries: "🛒", Transport: "🚗", Housing: "🏠", Utilities: "⚡", Shopping: "🛍️", "Personal Care": "💆",
  Entertainment: "🎬", Education: "📚", "Family & Pets": "👨‍👩‍👧‍👦", "Health & Medical": "🏥", Investment: "🏦", Saving: "🐷",
  "Transfer Out": "📤", "Debt Payment": "💳", "Gift & Donation": "💝", "Other Expense": "💸",
}

async function main() {
  const existing = new Set((await prisma.category.findMany({ where: { userId: null }, select: { name: true } })).map(c => c.name))
  const missing = CATEGORIES.filter(c => !existing.has(c.name))
  for (const c of missing) {
    await prisma.category.create({ data: { name: c.name, type: c.type, color: c.color, icon: ICONS[c.name] ?? "📁", userId: null } })
  }
  console.log(`Built-in categories: ${missing.length} created, ${existing.size} already present`)
}

main()
  .catch(e => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
