"use server"

import prisma from "@/lib/db"
import { getUser } from "@/features/auth/actions"
import { GoogleGenAI } from "@google/genai"

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

  const languageInstruction = language === 'th' 
    ? 'CRITICAL INSTRUCTION: You MUST write the ENTIRE report exclusively in THAI language. Do not use English.' 
    : 'Please write the report in English.'

  // Format data for AI
  const prompt = `
You are an expert, friendly financial advisor. Your client needs a quick review of their cash flow for the last 30 days.

# Client Data Summary
- Total Income: ฿${totalIncome}
- Total Expense: ฿${totalExpense}
- Net Balance: ฿${totalIncome - totalExpense}

# Expenses by Category
${Object.entries(categoryTotals).map(([cat, amount]) => `- ${cat}: ฿${amount}`).join('\n')}

# Top 5 Recent Transactions
${transactions.slice(0, 5).map(t => `- ${t.date.toISOString().split('T')[0]}: [${t.type}] ${t.category} ฿${t.amount} (${t.note})`).join('\n')}

# Your Task
Please provide a beautifully structured, concise Markdown report summarizing their financial health. 
Use markdown formatting like bold text, bullet points, and headers. Include emojis cautiously to keep it friendly.
Address the user naturally. Highlight any worrying spending habits if expense > income, or praise them if they are saving well. Provide exactly 3 bullet points of actionable advice based specifically on their spending categories.

${languageInstruction}
`

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.AI_API_KEY || "dummy" })
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.7,
      }
    })

    return { advice: response.text }
  } catch (error) {
    console.error("AI Generation Error", error)
    return { error: 'Failed to generate insights from Gemini API. Ensure API key is valid.', advice: null }
  }
}

export async function generateDashboardInsight(language: string = 'en', timeframe: 'YTD' | 'MONTH' | 'WEEK' = 'MONTH') {
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

  let timeText = ""
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

  const transactions = await prisma.transaction.findMany({
    where: { userId: prismaUser.id, date: { gte: startDate } },
  })

  let income = 0; let expense = 0;
  transactions.forEach(t => {
    if (t.type === 'INCOME') income += Number(t.amount)
    else expense += Number(t.amount)
  })

  if (income === 0 && expense === 0) {
    return { advice: null }
  }

  const languageInstruction = language === 'th' 
    ? 'CRITICAL: You MUST reply entirely in THAI language.' 
    : 'Please reply in English.'

  const prompt = `
You are a Personal Assistant. Client's ${timeText} cash flow:
Income: ฿${income}
Expense: ฿${expense}
Net: ฿${income - expense}

Provide EXACTLY ONE short, friendly, punchy sentence (max 20 words) giving an insight or encouragement based on this ratio. Do not use markdown.
${languageInstruction}
`

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.AI_API_KEY || "dummy" })
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { temperature: 0.7 }
    })
    return { advice: response.text }
  } catch (error) {
    return { advice: null }
  }
}
