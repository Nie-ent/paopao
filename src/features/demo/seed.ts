import prisma from "@/lib/db"
import { DEMO_LINE_ID } from "@/lib/auth-user"

const MONTHS_OF_HISTORY = 6
const RESET_AFTER_MS = 24 * 60 * 60 * 1000

type TxType = "INCOME" | "EXPENSE"
type DemoTx = { type: TxType; amount: number; category: string; note: string; date: Date }

// Small seeded PRNG so a given day always produces the same demo data
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildTransactions(now: Date): DemoTx[] {
  const rand = mulberry32(Number(now.toISOString().slice(0, 10).replace(/-/g, "")))
  const between = (min: number, max: number) => Math.round(min + rand() * (max - min))
  const pick = <T,>(items: T[]) => items[Math.floor(rand() * items.length)]
  const txs: DemoTx[] = []
  const add = (type: TxType, amount: number, category: string, note: string, date: Date) => {
    if (date <= now) txs.push({ type, amount, category, note, date })
  }
  const at = (y: number, m: number, d: number, h: number) => new Date(y, m, d, h, between(0, 59))

  const meals = [
    ["Pad kra pao with fried egg", 60, 90], ["Khao man gai", 50, 70], ["Boat noodles", 50, 80],
    ["Iced latte", 65, 110], ["Som tam & grilled chicken", 120, 220], ["Sushi lunch with team", 280, 450],
    ["7-Eleven snacks", 45, 120], ["Thai tea", 35, 60], ["Shabu dinner", 350, 600], ["Grab Food delivery", 150, 320],
  ] as const

  const start = new Date(now.getFullYear(), now.getMonth() - (MONTHS_OF_HISTORY - 1), 1)

  for (let m = 0; m < MONTHS_OF_HISTORY; m++) {
    const y = start.getFullYear() + Math.floor((start.getMonth() + m) / 12)
    const mo = (start.getMonth() + m) % 12
    const daysInMonth = new Date(y, mo + 1, 0).getDate()

    // Fixed monthly items
    add("EXPENSE", 12000, "Housing", "Condo rent", at(y, mo, 1, 9))
    add("EXPENSE", 599, "Utilities", "Fiber internet", at(y, mo, 3, 10))
    add("EXPENSE", 499, "Utilities", "Mobile plan", at(y, mo, 5, 10))
    add("EXPENSE", between(950, 1650), "Utilities", "Electricity bill", at(y, mo, 8, 19))
    add("EXPENSE", 419, "Entertainment", "Netflix", at(y, mo, 12, 8))
    add("EXPENSE", 149, "Entertainment", "Spotify", at(y, mo, 14, 8))
    add("INCOME", 65000, "Salary", "Monthly salary", at(y, mo, 25, 7))
    add("EXPENSE", 875, "Other Expense", "Social Security Auto-Deduction", at(y, mo, 25, 7))
    add("EXPENSE", 5000, "Investment", "DCA Bitcoin", at(y, mo, 26, 9))
    add("EXPENSE", 3000, "Investment", "DCA S&P 500 index fund", at(y, mo, 26, 9))
    add("EXPENSE", 6000, "Saving", "Transfer to emergency fund", at(y, mo, 26, 10))

    // Side income
    for (let i = 0; i < between(1, 2); i++) {
      const amount = between(i === 0 ? 30 : 8, i === 0 ? 50 : 30) * 500
      // First gig always lands early so the current month never opens with zero income
      const date = at(y, mo, i === 0 ? 2 : between(10, 22), 15)
      add("INCOME", amount, "Freelance", pick(["Landing page project", "API integration gig", "Bug-fix contract", "Dashboard UI freelance"]), date)
      add("EXPENSE", Math.round(amount * 0.03), "Other Expense", "Withholding Tax Auto-Deduction (3%)", date)
    }
    if (rand() < 0.5) add("INCOME", between(800, 2400), "Investment Income", "Fund dividend", at(y, mo, between(10, 20), 11))

    // Daily spending
    for (let d = 1; d <= daysInMonth; d++) {
      const weekday = new Date(y, mo, d).getDay()
      const isWorkday = weekday !== 0 && weekday !== 6
      for (let i = 0; i < between(1, 3); i++) {
        const [note, min, max] = pick([...meals])
        add("EXPENSE", between(min, max), "Food", note, at(y, mo, d, pick([8, 12, 13, 18, 19])))
      }
      if (isWorkday) add("EXPENSE", pick([44, 52, 59, 62]), "Transport", "BTS to office", at(y, mo, d, 8))
      if (rand() < 0.15) add("EXPENSE", between(120, 280), "Transport", "Grab ride", at(y, mo, d, 21))
      if (weekday === 6) add("EXPENSE", between(600, 1500), "Groceries", pick(["Lotus's groceries", "Tops Market", "Big C weekly shop"]), at(y, mo, d, 11))
      if (rand() < 0.08) add("EXPENSE", between(300, 2900), "Shopping", pick(["Shopee order", "Uniqlo", "Lazada gadget", "Running shoes"]), at(y, mo, d, 20))
      if (rand() < 0.05) add("EXPENSE", between(220, 900), "Entertainment", pick(["Movie night", "Bowling with friends", "Board game cafe"]), at(y, mo, d, 20))
      if (rand() < 0.03) add("EXPENSE", between(350, 1800), "Health & Medical", pick(["Pharmacy", "Dental check-up", "Gym day pass"]), at(y, mo, d, 17))
    }
    if (rand() < 0.4) add("EXPENSE", between(990, 2490), "Education", pick(["Udemy course", "Tech book", "Online certification"]), at(y, mo, between(2, 27), 21))
    if (rand() < 0.5) add("EXPENSE", between(1000, 3000), "Family & Pets", "Send money to parents", at(y, mo, between(26, Math.min(28, daysInMonth)), 18))
  }

  return txs
}

async function wipeDemoUser(userId: string) {
  await prisma.$transaction([
    prisma.questClaim.deleteMany({ where: { userId } }),
    prisma.rewardClaim.deleteMany({ where: { userId } }),
    prisma.subscriptionPayment.deleteMany({ where: { userId } }),
    prisma.chatSession.deleteMany({ where: { userId } }),
    prisma.goal.deleteMany({ where: { userId } }),
    prisma.transaction.deleteMany({ where: { userId } }),
    prisma.category.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ])
}

export async function resetDemoData(now = new Date()) {
  const existing = await prisma.user.findUnique({ where: { lineId: DEMO_LINE_ID } })
  if (existing) await wipeDemoUser(existing.id)

  const categories = await prisma.category.findMany({ where: { userId: null } })
  const categoryId = (name: string) => {
    const found = categories.find(c => c.name === name)
    if (!found) throw new Error(`Demo seed: missing global category "${name}"`)
    return found.id
  }

  const user = await prisma.user.create({
    data: {
      lineId: DEMO_LINE_ID,
      name: "Demo User",
      hasAcceptedPDPA: true,
      paoPoints: 85,
      aiSlipsUsed: 12,
    },
  })

  const txs = buildTransactions(now)
  await prisma.transaction.createMany({
    data: txs.map(t => ({ userId: user.id, type: t.type, amount: t.amount, categoryId: categoryId(t.category), note: t.note, date: t.date })),
  })

  const historyStart = new Date(now.getFullYear(), now.getMonth() - (MONTHS_OF_HISTORY - 1), 1)
  await prisma.goal.createMany({
    data: [
      { userId: user.id, type: "FINANCIAL", title: "Emergency Fund (6 months)", description: "Six months of living expenses", targetAmount: 200000, currentAmount: 128000, deadline: new Date(now.getFullYear() + 1, 5, 30) },
      { userId: user.id, type: "FINANCIAL", title: "Invest ฿60k by year end", description: "Bitcoin + S&P 500 DCA", targetAmount: 60000, trackCategory: "Investment", createdAt: historyStart, deadline: new Date(now.getFullYear(), 11, 31) },
      { userId: user.id, type: "FINANCIAL", title: "Japan trip", description: "Tokyo & Osaka, 7 days", targetAmount: 45000, currentAmount: 18500, deadline: new Date(now.getFullYear() + 1, 2, 31) },
      { userId: user.id, type: "TODO", title: "Cancel unused subscriptions", description: "Review streaming and app subscriptions" },
      { userId: user.id, type: "TODO", title: "Compare health insurance plans" },
      { userId: user.id, type: "TODO", title: "Monthly spending review", description: "Added by PaoPao AI from chat" },
    ],
  })

  await prisma.chatSession.create({
    data: {
      userId: user.id,
      title: "💰 Emergency fund plan",
      messages: [
        { role: "user", content: "I save about 6,000 baht a month. How long until my emergency fund reaches 200,000?" },
        { role: "model", content: "Great habit! 🎉 You already have **฿128,000**, so you need **฿72,000** more.\n\n- At ฿6,000/month → about **12 months**\n- At ฿8,000/month → about **9 months**\n\nYour food spending is your most flexible category. Trimming delivery orders by ฿2,000/month would get you there 3 months sooner. Want me to add this as a goal? 🎯" },
        { role: "user", content: "Yes, add a reminder to review my spending every month." },
        { role: "model", content: "Done! ✅ I added **\"Monthly spending review\"** to your goals. You've got this! 💪" },
      ],
    },
  })

  return { userId: user.id, transactions: txs.length }
}

/** Re-seeds the demo account when it is missing, older than a day, or has no data this month. */
export async function ensureDemoData() {
  const now = new Date()
  const user = await prisma.user.findUnique({ where: { lineId: DEMO_LINE_ID } })
  if (user && now.getTime() - user.createdAt.getTime() < RESET_AFTER_MS) {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const thisMonth = await prisma.transaction.count({ where: { userId: user.id, date: { gte: startOfMonth } } })
    if (thisMonth > 0) return
  }
  await resetDemoData(now)
}
