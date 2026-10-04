"use server"

import prisma from "@/lib/db"
import { getProfileData } from "@/features/user/actions"
import { Type } from "@google/genai"
import { generateContent, startChat, isQuotaError } from "@/lib/ai"
import { DEMO_LINE_ID } from "@/lib/auth-user"


const SYSTEM_INSTRUCTION = `You are PaoPao, a friendly and expert financial assistant.
You help users plan their savings, resolve debts, or organize their financial and daily tasks.
You must speak in a friendly tone (using emojis!). 
If you and the user agree on a clear action plan, you can use the 'createTaskOrGoal' tool to add tasks (TODO) or financial targets (FINANCIAL) to the user's dashboard automatically. Always ask for permission before using the tool.`

// Messages per Bangkok day. The demo account is shared by every visitor, so its cap is account-wide.
const DAILY_CHAT_LIMITS = { DEMO: 30, FREE: 10, PRO: 100, BUSINESS: 100 } as const
const MAX_REPLY_TOKENS = 800

function startOfBangkokDay(now = new Date()) {
  const offset = 7 * 60 * 60 * 1000
  const bkk = new Date(now.getTime() + offset)
  return new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate()) - offset)
}

/** Counts the user's chat messages sent today, using the `at` timestamp stored on each message. */
async function countMessagesToday(userId: string) {
  const since = startOfBangkokDay()
  const sessions = await prisma.chatSession.findMany({
    where: { userId, updatedAt: { gte: since } },
    select: { messages: true }
  })
  return sessions.reduce((total, s) => {
    const messages = (Array.isArray(s.messages) ? s.messages : []) as { role?: string; at?: string }[]
    return total + messages.filter(m => m.role === 'user' && m.at && new Date(m.at) >= since).length
  }, 0)
}

const tools: any = [{
  functionDeclarations: [{
    name: "createTaskOrGoal",
    description: "Create a new financial goal or a generic todo task on the user's dashboard.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        type: { type: Type.STRING, enum: ["FINANCIAL", "TODO"], description: "Use FINANCIAL for money targets, TODO for general action items." },
        title: { type: Type.STRING, description: "Actionable title (e.g. 'Pay credit card debt', 'Save for Japan')" },
        description: { type: Type.STRING, description: "Optional details" },
        targetAmount: { type: Type.NUMBER, description: "Target amount if FINANCIAL. Use 0 if it's a TODO." }
      },
      required: ["type", "title", "targetAmount"]
    }
  }]
}]

export async function getChatSessions() {
  const user = await getProfileData()
  if (!user) return []
  return prisma.chatSession.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' }
  })
}

export async function getSession(sessionId: string) {
  const user = await getProfileData()
  if (!user) return null
  return prisma.chatSession.findFirst({
    where: { id: sessionId, userId: user.id }
  })
}

export async function sendChatMessage(sessionId: string | null, message: string, language: 'th' | 'en' = 'th') {
  const user = await getProfileData()
  if (!user) return { error: "Unauthorized" }

  const dailyLimit = user.lineId === DEMO_LINE_ID ? DAILY_CHAT_LIMITS.DEMO : DAILY_CHAT_LIMITS[user.subscriptionTier]
  if (await countMessagesToday(user.id) >= dailyLimit) {
    return { error: "Daily chat limit reached", limitReached: true, limit: dailyLimit }
  }

  let activeSessionId = sessionId
  let isNewSession = false
  let newSessionTitle: string | null = null
  let historyMessages: any[] = []
  
  if (activeSessionId) {
    const session = await prisma.chatSession.findFirst({ where: { id: activeSessionId, userId: user.id } })
    if (session && session.messages) {
      historyMessages = typeof session.messages === 'string' ? JSON.parse(session.messages) : session.messages as any[]
    }
  } else {
    // Generate Title gracefully falling back if Quota exceeded
    let title = language === 'en' ? "💬 New chat" : "💬 บทสนทนาใหม่"
    try {
      const titleRes = await generateContent({
        config: { maxOutputTokens: 30, thinkingConfig: { thinkingBudget: 0 } },
        contents: `Generate a 3-word ${language === 'en' ? 'English' : 'Thai'} title with 1 emoji, reply with the title only: "${message.substring(0, 50)}"`
      })
      if (titleRes.text) title = titleRes.text.trim()
    } catch (titleErr) {
      console.warn("Title generation failed, likely quota exceeded. Using default title.")
    }
    
    const newSession = await prisma.chatSession.create({
      data: {
        userId: user.id,
        title,
        messages: []
      }
    })
    activeSessionId = newSession.id
    isNewSession = true
    newSessionTitle = title
  }

  // Format history for model - Optimize: Keep only the last 6 messages to save input tokens
  const recentHistory = historyMessages.slice(-6)
  const formattedHistory = recentHistory.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }))

  try {
    const { chat, response } = await startChat({
      config: { systemInstruction: `${SYSTEM_INSTRUCTION}\nReply in ${language === 'en' ? 'English' : 'Thai'} unless the user writes in another language. Keep replies concise.`, tools, temperature: 0.7, maxOutputTokens: MAX_REPLY_TOKENS, thinkingConfig: { thinkingBudget: 0 } },
      history: formattedHistory
    }, { message })
    historyMessages.push({ role: 'user', content: message, at: new Date().toISOString() })

    let botReply = response.text || ""
    let createdGoal = null

    // Check for Function Calling
    if (response.functionCalls && response.functionCalls.length > 0) {
      const call = response.functionCalls[0]
      if (call.name === "createTaskOrGoal") {
        const args = call.args as any
        
        // Execute real DB action
        const newGoal = await prisma.goal.create({
          data: {
            userId: user.id,
            type: args.type || "TODO",
            title: args.title || "แผนงาน",
            description: args.description || "สร้างโดย PaoPao AI",
            targetAmount: Number(args.targetAmount) || 0,
            currentAmount: 0
          }
        })

        createdGoal = newGoal

        // Reply to model with function response so it can summarize
        const followUp = await chat.sendMessage({
          message: [{
            functionResponse: {
              name: "createTaskOrGoal",
              response: { success: true, goalId: newGoal.id, message: "Added to database successfully." }
            }
          }]
        })

        botReply = followUp.text || botReply
      }
    }

    historyMessages.push({ role: 'model', content: botReply, at: new Date().toISOString() })

    await prisma.chatSession.update({
      where: { id: activeSessionId },
      data: { messages: historyMessages as any }
    })

    return { 
      success: true, 
      sessionId: activeSessionId,
      newSessionTitle,
      reply: botReply,
      action: createdGoal ? { title: createdGoal.title, type: createdGoal.type } : null
    }

  } catch (error: any) {
    console.error("AI Error:", error)
    // Don't leave an empty conversation in the history when the very first message fails
    if (isNewSession) await prisma.chatSession.delete({ where: { id: activeSessionId! } }).catch(() => {})
    const isQuota = isQuotaError(error)
    return { error: "Failed to communicate with AI.", isQuota }
  }
}
