import { GoogleGenAI, type Chat, type CreateChatParameters, type GenerateContentParameters, type SendMessageParameters } from "@google/genai"

export const ai = new GoogleGenAI({ apiKey: process.env.AI_API_KEY || "dummy_key" })

/**
 * Models tried in order. Gemini models get overloaded (503), rate-limited (429) or retired for new
 * API keys (404), so every call falls through to the next one. Keep distinct models next to each
 * other: aliases like gemini-flash-latest may point at the first model and share its quota.
 * Override with AI_MODELS="model-a,model-b".
 */
export const AI_MODELS = (process.env.AI_MODELS || "gemini-3.8-flash,gemini-3.5-flash,gemini-flash-latest")
  .split(",")
  .map(m => m.trim())
  .filter(Boolean)

/** Overloaded (503), rate-limited (429) and internal (500) errors usually clear within seconds. */
export function isAiBusyError(error: unknown) {
  const status = (error as { status?: number })?.status
  return status === 503 || status === 429 || status === 500
}

/** Pauses before each extra round over the model list, used only when every model was busy. */
const BUSY_RETRY_DELAYS_MS = [2000, 5000]

export async function withModelFallback<T>(
  run: (model: string) => Promise<T>,
  { models = AI_MODELS, retryDelaysMs = BUSY_RETRY_DELAYS_MS } = {},
): Promise<T> {
  let lastError: unknown
  for (let round = 0; round <= retryDelaysMs.length; round++) {
    if (round > 0) await new Promise(resolve => setTimeout(resolve, retryDelaysMs[round - 1]))
    let allBusy = true
    for (const model of models) {
      try {
        return await run(model)
      } catch (error) {
        lastError = error
        if (!isAiBusyError(error)) allBusy = false
        console.warn(`AI model ${model} failed (round ${round + 1})`, (error as { status?: number })?.status ?? error)
      }
    }
    // A retired model or a bad request will not fix itself, so only retry when everything was busy
    if (!allBusy) break
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
