"use server"

import prisma from "@/lib/db"
import { getUser } from "@/features/auth/actions"
import { GoogleGenAI } from "@google/genai"
import { unstable_cache } from "next/cache"

const getCachedInsight = unstable_cache(
  async (prompt: string, cacheDateString: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.AI_API_KEY || "dummy" })
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
      config: { temperature: 0.7 }
    })
    return response.text
  },
  ['gemini-dashboard-insight'],
  { revalidate: 86400 } // 24 hours
)

const getCachedFinancialAdvice = unstable_cache(
  async (prompt: string, cacheDateString: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.AI_API_KEY || "dummy" })
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
      config: { temperature: 0.7 }
    })
    return response.text
  },
  ['gemini-financial-advice'],
  { revalidate: 86400 }
)

export async function generateFinancialAdvice(language: string = 'en') {
  const user = await getUser()
  if (!user) {
    return { error: 'Unauthorized', advice: null }
  }

  // Determine LINE ID to match with Prisma
  let lineId = "U9f4477a859862ce8589b09e879ec068c"
  if (user.app_metadata?.provider === "line") {
    lineId = (user as any).user_metadata.provider_id
  }

  const prismaUser = await prisma.user.findUnique({
    where: { lineId }
  })

  if (!prismaUser) {
    return { error: 'User not found', advice: null }
  }

  // Fetch all transactions for the last 30 days
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const transactions = await prisma.transaction.findMany({
    where: {
      userId: prismaUser.id,
      date: { gte: thirtyDaysAgo }
    },
    orderBy: { date: 'desc' }
  })

  if (transactions.length === 0) {
    return { error: 'Not enough data. Please log some transactions via LINE first.', advice: null }
  }

  // Aggregate by category
  let totalIncome = 0
  let totalExpense = 0
  const categoryTotals: Record<string, number> = {}

  transactions.forEach(t => {
    if (t.type === 'INCOME') {
      totalIncome += t.amount
    } else {
      totalExpense += t.amount
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount
    }
  })

  // Format data for AI natively in the localized tongue to avoid interpretation drift
  const expensesList = Object.entries(categoryTotals).map(([cat, amount]) => `- ${cat}: ฿${amount.toLocaleString()}`).join('\n')
  const transactionsList = transactions.slice(0, 5).map(t => `- ${t.date.toISOString().split('T')[0]}: [${t.type === 'INCOME' ? 'รับ' : 'จ่าย'}] ${t.category} ฿${t.amount.toLocaleString()} (${t.note || '-'})`).join('\n')

  const prompt = language === 'th' ? `
คุณเป็นผู้เชี่ยวชาญการให้คำปรึกษาทางการเงินส่วนบุคคล หน้าที่ของคุณคือการวิเคราะห์ภาพรวมการเงินใน 30 วันที่ผ่านมาของลูกค้า

# ข้อมูลผู้ใช้งาน
- รายรับรวม: ฿${totalIncome.toLocaleString()}
- รายจ่ายรวม: ฿${totalExpense.toLocaleString()}
- ยอดเงินคงเหลือ: ฿${(totalIncome - totalExpense).toLocaleString()}

# หมวดหมู่รายจ่าย
${expensesList}

# รายการเข้าออก 5 รายการล่าสุด
${transactionsList}

# งานของคุณ
โปรดเขียนรายงานสรุปสุขภาพการเงินสั้นๆ แบบมืออาชีพ ใช้ markdown จัดหน้าให้สวยงาม (ตัวหนา, bullet) และอาจใช้ Emoji ประกอบเพื่อความน่าอ่านแบบพอดี เป็นกันเองวิเคราะห์ทั้งข้อดีและสิ่งที่ควรระวังตามหมวดหมู่การใช้เงิน และให้คำแนะนำที่นำไปปฏิบัติได้จริงเป๊ะๆ **3 ข้อ**
ตอบกลับเป็นภาษาไทยล้วน ห้ามใช้ภาษาอังกฤษเด็ดขาด
` : `
You are an expert, friendly financial advisor. Your client needs a quick review of their cash flow for the last 30 days.

# Client Data Summary
- Total Income: ฿${totalIncome.toLocaleString()}
- Total Expense: ฿${totalExpense.toLocaleString()}
- Net Balance: ฿${(totalIncome - totalExpense).toLocaleString()}

# Expenses by Category
${expensesList}

# Top 5 Recent Transactions
${transactionsList}

# Your Task
Please provide a beautifully structured, concise Markdown report summarizing their financial health. 
Use markdown formatting like bold text, bullet points, and headers. Include emojis cautiously to keep it friendly.
Address the user naturally. Highlight any worrying spending habits if expense > income, or praise them if they are saving well. Provide exactly 3 bullet points of actionable advice based specifically on their spending categories.
Reply entirely in English.
`;

  try {
    const today = new Date().toISOString().split('T')[0]
    const insightText = await getCachedFinancialAdvice(prompt, today)
    return { advice: insightText, error: null }
  } catch (error) {
    console.error("AI Generation Error", error)
    return { error: 'Failed to generate insights from Gemini API. Ensure API key is valid.', advice: null }
  }
}

export async function generateDashboardInsight(language: string = 'en', timeframe: 'ALL' | 'YTD' | 'MONTH' | 'WEEK' = 'MONTH') {
  const user = await getUser()
  if (!user) return { advice: null }

  let lineId = "U9f4477a859862ce8589b09e879ec068c"
  if (user.app_metadata?.provider === "line") {
    lineId = (user as any).user_metadata.provider_id
  }

  const prismaUser = await prisma.user.findUnique({
    where: { lineId }
  })

  if (!prismaUser) return { advice: null }

  const now = new Date()
  let startDate = new Date()

  let timeText = "All Time"
  if (timeframe === 'YTD') {
    startDate = new Date(now.getFullYear(), 0, 1)
    timeText = "Year-to-Date"
  } else if (timeframe === 'MONTH') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    timeText = "This Month's"
  } else if (timeframe === 'WEEK') {
    startDate = new Date(now)
    startDate.setDate(now.getDate() - 6)
    startDate.setHours(0, 0, 0, 0)
    timeText = "Last 7 days"
  }

  const whereClause: any = { userId: prismaUser.id }
  if (timeframe !== 'ALL') {
    whereClause.date = { gte: startDate }
  }

  const transactions = await prisma.transaction.findMany({
    where: whereClause,
  })

  let income = 0; let expense = 0;
  transactions.forEach(t => {
    if (t.type === 'INCOME') income += Number(t.amount)
    else expense += Number(t.amount)
  })

  if (income === 0 && expense === 0) {
    return { advice: null }
  }

  const prompt = language === 'th'
    ? `คุณเป็นผู้ช่วยยามการเงินส่วนตัว ข้อมูลกระแสเงินสด ${timeText} ของผู้ใช้งาน:
รายรับ: ฿${income}
รายจ่าย: ฿${expense}
คงเหลือ: ฿${income - expense}

ให้คำแนะนำหรือกำลังใจสั้นๆ เป็นกันเอง เพียงแค่ 1 ประโยค (ไม่เกิน 20 คำ) โดยอิงจากสัดส่วนของรายรับและรายจ่ายนี้ ตอบเป็นภาษาไทยเท่านั้น และห้ามใช้ markdown`
    : `You are a Personal Assistant. Client's ${timeText} cash flow:
Income: ฿${income}
Expense: ฿${expense}
Net: ฿${income - expense}

Provide EXACTLY ONE short, friendly, punchy sentence (max 20 words) giving an insight or encouragement based on this ratio. Reply in English. Do not use markdown.`;

  try {
    const today = new Date().toISOString().split('T')[0] // "2026-04-20"
    const adviceText = await getCachedInsight(prompt, today)
    return { advice: adviceText, error: null }
  } catch (error) {
    console.error("AI Generation Error", error)
    return { advice: null, error: "AI service failed" }
  }
}
