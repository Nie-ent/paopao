"use server"

import prisma from "@/lib/db"
import { getProfileData } from "@/features/user/actions"
import { GoogleGenAI, Type } from "@google/genai"

const apiKey = process.env.AI_API_KEY || "dummy_key"
const ai = new GoogleGenAI({ apiKey })

const SYSTEM_INSTRUCTION = `You are PaoPao, a friendly and expert financial assistant.
You help users plan their savings, resolve debts, or organize their financial and daily tasks.
You must speak in a friendly tone (using emojis!). 
If you and the user agree on a clear action plan, you can use the 'createTaskOrGoal' tool to add tasks (TODO) or financial targets (FINANCIAL) to the user's dashboard automatically. Always ask for permission before using the tool.`

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

export async function sendChatMessage(sessionId: string | null, message: string) {
  const user = await getProfileData()
  if (!user) return { error: "Unauthorized" }

  let activeSessionId = sessionId
  let historyMessages: any[] = []
  
  if (activeSessionId) {
    const session = await prisma.chatSession.findFirst({ where: { id: activeSessionId, userId: user.id } })
    if (session && session.messages) {
      historyMessages = JSON.parse(session.messages)
    }
  } else {
    // Generate Title gracefully falling back if Quota exceeded
    let title = "💬 บทสนทนาใหม่"
    try {
      const titleRes = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Generate 3-word Thai title with 1 emoji: "${message.substring(0, 50)}"`
      })
      if (titleRes.text) title = titleRes.text.trim()
    } catch (titleErr) {
      console.warn("Title generation failed, likely quota exceeded. Using default title.")
    }
    
    const newSession = await prisma.chatSession.create({
      data: {
        userId: user.id,
        title,
        messages: JSON.stringify([])
      }
    })
    activeSessionId = newSession.id
  }

  // Format history for model - Optimize: Keep only the last 6 messages to save input tokens
  const recentHistory = historyMessages.slice(-6)
  const formattedHistory = recentHistory.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }))

  const chat = ai.chats.create({
    model: "gemini-2.5-flash",
    config: { systemInstruction: SYSTEM_INSTRUCTION, tools, temperature: 0.7 },
    history: formattedHistory
  })

  try {
    const response = await chat.sendMessage(message as any)
    historyMessages.push({ role: 'user', content: message })

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
        const followUp = await chat.sendMessage([{
          functionResponse: {
            name: "createTaskOrGoal",
            response: { success: true, goalId: newGoal.id, message: "Added to database successfully." }
          }
        }] as any)

        botReply = followUp.text || botReply
      }
    }

    historyMessages.push({ role: 'model', content: botReply })

    await prisma.chatSession.update({
      where: { id: activeSessionId },
      data: { messages: JSON.stringify(historyMessages) }
    })

    return { 
      success: true, 
      sessionId: activeSessionId, 
      reply: botReply,
      action: createdGoal ? { title: createdGoal.title, type: createdGoal.type } : null
    }

  } catch (error: any) {
    console.error("AI Error:", error)
    return { error: "Failed to communicate with AI." }
  }
}
