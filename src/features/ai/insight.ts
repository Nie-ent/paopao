"use server"

/**
 * PaoPao's monthly money analysis. One AI call writes both the one-line headline on the dashboard
 * and the full report on /ai-insights, for the current Bangkok calendar month. The result is kept
 * (AiInsight), so opening either page never calls the AI again: the user starts an analysis with
 * a button, and can redo it with the month's latest numbers on /ai-insights (a few times a day).
 */
import { Type, type Schema } from "@google/genai"
import prisma from "@/lib/db"
import { getCurrentUser } from "@/lib/current-user"
import { bangkokMonthRange, bangkokParts } from "@/lib/dates"
import { AI_MODELS, generateContent, isQuotaError, modelsForPlan } from "@/lib/ai"
import { withAiUser } from "@/lib/ai-usage"
import { effectivePlan } from "@/lib/subscription"
import { loadFixedCosts } from "@/lib/finance-context"
import { fixedCostContext } from "@/lib/fixed-costs"
import { roundMoney } from "@/lib/money"
import { trackFeature } from "@/lib/feature-events"
import { consumeDailyUsage, refundUsage } from "@/lib/usage"
import { INSIGHT_REDOS_PER_DAY } from "@/features/ai/insight-limits"


type Lang = "th" | "en"
export type MonthlyInsight =
  | { status: "ready"; period: string; headline: string; report: string; generatedAt: string }
  | { status: "none"; period: string }
  | { status: "error"; period: string; reason: "NO_DATA" | "QUOTA" | "AI_ERROR" | "LIMIT" | "UNAUTHORIZED" }

const periodOf = (now = new Date()) => {
  const { year, month } = bangkokParts(now)
  return { year, month, key: `${year}-${String(month + 1).padStart(2, "0")}` }
}
const lang = (l: string): Lang => (l === "en" ? "en" : "th")
const ready = (row: { period: string; headline: string; report: string; updatedAt: Date }): MonthlyInsight =>
  ({ status: "ready", period: row.period, headline: row.headline, report: row.report, generatedAt: row.updatedAt.toISOString() })

/** This month's saved analysis, if any. Never calls the AI. */
export async function getMonthlyInsight(language: string): Promise<MonthlyInsight> {
  const { key } = periodOf()
  const user = await getCurrentUser()
  if (!user) return { status: "error", period: key, reason: "UNAUTHORIZED" }
  const row = await prisma.aiInsight.findUnique({ where: { userId_period_language: { userId: user.id, period: key, language: lang(language) } } })
  return row ? ready(row) : { status: "none", period: key }
}

/**
 * Analyses this month. Returns the saved analysis when there is one, unless `fresh` (the
 * "analyse again" button on /ai-insights), which is limited per day.
 */
export async function analyzeMonth(language: string, fresh = false): Promise<MonthlyInsight> {
  const { year, month, key } = periodOf()
  const l = lang(language)
  const user = await getCurrentUser()
  if (!user) return { status: "error", period: key, reason: "UNAUTHORIZED" }

  const saved = await prisma.aiInsight.findUnique({ where: { userId_period_language: { userId: user.id, period: key, language: l } } })
  if (saved && !fresh) return ready(saved)

  // Redoing an analysis costs an AI call each time: a few a day is plenty
  const usageId = saved ? await consumeDailyUsage(user.id, "insight_redo", INSIGHT_REDOS_PER_DAY) : null
  if (saved && !usageId) return { status: "error", period: key, reason: "LIMIT" }

  const prompt = await buildPrompt(user.id, year, month, l)
  if (!prompt) {
    if (usageId) await refundUsage(usageId)
    return { status: "error", period: key, reason: "NO_DATA" }
  }

  try {
    const response = await withAiUser(user.id, () => generateContent({
      contents: prompt,
      config: { temperature: 0.6, responseMimeType: "application/json", responseSchema: SCHEMA },
    }, { models: effectivePlan(user) === "FREE" ? modelsForPlan("FREE") : AI_MODELS, feature: "insight" }))
    const parsed = JSON.parse(response.text ?? "{}") as { headline?: string; report?: string }
    const headline = String(parsed.headline ?? "").trim().slice(0, 300)
    const report = String(parsed.report ?? "").trim().slice(0, 8000)
    if (!headline || !report) throw new Error("empty insight")
    const row = await prisma.aiInsight.upsert({
      where: { userId_period_language: { userId: user.id, period: key, language: l } },
      create: { userId: user.id, period: key, language: l, headline, report },
      update: { headline, report },
    })
    await trackFeature(saved ? "web_advice" : "web_insight", { source: "web", userId: user.id })
    return ready(row)
  } catch (error) {
    console.error("[insight] analysis failed", error)
    if (usageId) await refundUsage(usageId)
    return { status: "error", period: key, reason: isQuotaError(error) ? "QUOTA" : "AI_ERROR" }
  }
}

const SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    headline: { type: Type.STRING, description: "One friendly sentence, at most 20 words, no markdown: the single most useful takeaway this month" },
    report: { type: Type.STRING, description: "The full analysis in Markdown" },
  },
  required: ["headline", "report"],
}

/** The month's numbers as an AI prompt, or null when nothing was recorded this month. */
async function buildPrompt(userId: string, year: number, month: number, l: Lang) {
  const range = bangkokMonthRange(year, month)
  const prev = bangkokMonthRange(year, month - 1)
  const [transactions, prevTotals, fixed] = await Promise.all([
    prisma.transaction.findMany({ where: { userId, date: range }, include: { category: true }, orderBy: { amount: "desc" } }),
    prisma.transaction.groupBy({ by: ["type"], where: { userId, date: prev }, _sum: { amount: true } }),
    loadFixedCosts(userId),
  ])
  if (transactions.length === 0) return null

  let income = 0, expense = 0
  const byCategory: Record<string, number> = {}
  for (const t of transactions) {
    if (t.type === "INCOME") income += t.amount
    else {
      expense += t.amount
      const name = t.category?.name || "Other"
      byCategory[name] = (byCategory[name] ?? 0) + t.amount
    }
  }
  income = roundMoney(income); expense = roundMoney(expense)
  const prevIncome = roundMoney(prevTotals.find(p => p.type === "INCOME")?._sum.amount ?? 0)
  const prevExpense = roundMoney(prevTotals.find(p => p.type === "EXPENSE")?._sum.amount ?? 0)
  const categories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([c, a]) => `- ${c}: ฿${roundMoney(a).toLocaleString()}`).join("\n")
  const biggest = transactions.filter(t => t.type === "EXPENSE").slice(0, 5)
    .map(t => `- ${t.category?.name || "Other"} ฿${t.amount.toLocaleString()}${t.note ? ` (${t.note})` : ""}`).join("\n")
  const today = bangkokParts(new Date()).day
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const fixedLines = fixedCostContext(fixed.summary, l)

  const data = `
- ${l === "th" ? "วันที่" : "Day"} ${today}/${daysInMonth}
- ${l === "th" ? "รายรับ" : "Income"}: ฿${income.toLocaleString()} (${l === "th" ? "เดือนก่อน" : "last month"} ฿${prevIncome.toLocaleString()})
- ${l === "th" ? "รายจ่าย" : "Spending"}: ฿${expense.toLocaleString()} (${l === "th" ? "เดือนก่อน" : "last month"} ฿${prevExpense.toLocaleString()})
- ${l === "th" ? "คงเหลือ" : "Left over"}: ฿${roundMoney(income - expense).toLocaleString()}

# ${l === "th" ? "ค่าใช้จ่ายคงที่" : "Fixed costs"}
${fixedLines}

# ${l === "th" ? "รายจ่ายตามหมวด" : "Spending by category"}
${categories || "-"}

# ${l === "th" ? "รายจ่ายก้อนใหญ่สุด" : "Largest expenses"}
${biggest || "-"}`

  return l === "th"
    ? `คุณเป็นที่ปรึกษาการเงินส่วนตัวที่เป็นกันเอง วิเคราะห์การเงินของผู้ใช้ "เดือนนี้" (ยังไม่จบเดือน ให้คำนึงถึงวันที่ปัจจุบัน) เทียบกับเดือนก่อน
${data}

เขียน:
1. headline: 1 ประโยคสั้น ไม่เกิน 20 คำ ไม่มี markdown เป็นข้อสังเกตที่มีประโยชน์ที่สุดของเดือนนี้
2. report: รายงาน markdown กระชับ มีหัวข้อ "ภาพรวมเดือนนี้" "จุดที่ทำได้ดี" "จุดที่ควรระวัง" และ "สิ่งที่ทำได้เลย 3 ข้อ" อ้างอิงตัวเลขจริง ใช้ emoji พอประมาณ
ตอบเป็นภาษาไทยทั้งหมด`
    : `You are a friendly personal finance coach. Analyse the user's money "this month" (the month isn't over: mind the current day) against last month.
${data}

Write:
1. headline: one short sentence, max 20 words, no markdown: the most useful takeaway this month
2. report: a concise Markdown report with sections "This month at a glance", "What's going well", "Watch out for" and "3 things to do now", citing the real numbers, with a few emojis
Reply entirely in English.`
}
