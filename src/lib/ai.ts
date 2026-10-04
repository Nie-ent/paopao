import { GoogleGenAI, type Chat, type CreateChatParameters, type GenerateContentParameters, type SendMessageParameters } from "@google/genai"

export const ai = new GoogleGenAI({ apiKey: process.env.AI_API_KEY || "dummy_key" })

/**
 * Models tried in order. Gemini models get overloaded (503) or retired for new API keys (404),
 * so every call falls through to the next one. Override with AI_MODELS="model-a,model-b".
 */
export const AI_MODELS = (process.env.AI_MODELS || "gemini-3.8-flash,gemini-flash-latest,gemini-3.5-flash")
  .split(",")
  .map(m => m.trim())
  .filter(Boolean)

async function withModelFallback<T>(run: (model: string) => Promise<T>): Promise<T> {
  let lastError: unknown
  for (const model of AI_MODELS) {
    try {
      return await run(model)
    } catch (error) {
      lastError = error
      console.warn(`AI model ${model} failed, trying next`, error)
    }
  }
  throw lastError
}

export function generateContent(params: Omit<GenerateContentParameters, "model">) {
  return withModelFallback(model => ai.models.generateContent({ ...params, model }))
}

/** Creates a chat and sends the first message, moving to the next model if that model fails. */
export function startChat(params: Omit<CreateChatParameters, "model">, message: SendMessageParameters) {
  return withModelFallback(async model => {
    const chat: Chat = ai.chats.create({ ...params, model })
    const response = await chat.sendMessage(message)
    return { chat, response }
  })
}

export function isQuotaError(error: unknown) {
  const err = error as { status?: number; message?: string } | undefined
  const msg = String(err?.message || "").toLowerCase()
  return err?.status === 429 || msg.includes("429") || msg.includes("quota") || msg.includes("exhausted")
}
