import { GoogleGenAI, type Chat, type CreateChatParameters, type GenerateContentParameters, type SendMessageParameters } from "@google/genai"

export const ai = new GoogleGenAI({ apiKey: process.env.AI_API_KEY || "dummy_key" })

/**
 * Models tried in order. Gemini models get overloaded (503), rate-limited (429) or retired for new
 * API keys (404), so every call falls through to the next one. Use distinct models: an alias like
 * gemini-flash-latest points at one of them and is busy whenever it is. The lite model is less
 * accurate but runs on separate capacity, so it is the last resort.
 * Override with AI_MODELS="model-a,model-b".
 */
export const AI_MODELS = (process.env.AI_MODELS || "gemini-3.8-flash,gemini-3.5-flash,gemini-3.5-flash-lite")
  .split(",")
  .map(m => m.trim())
  .filter(Boolean)

/**
 * Overloaded (503), rate-limited (429), internal (500) and gateway (502/504) errors usually clear within seconds. A
 * model that didn't answer before our timeout (AbortError) is overloaded too, just more quietly.
 */
export function isAiBusyError(error: unknown) {
  const { status, name } = (error ?? {}) as { status?: number; name?: string }
  return [429, 500, 502, 503, 504].includes(status ?? 0) || name === "AbortError" || name === "TimeoutError"
}

/**
 * How long each model may take before we move on. The last model has no limit: it is the final
 * chance. Two timeouts plus the last model must fit in the LINE webhook's 60s maxDuration.
 */
export const DEFAULT_MODEL_TIMEOUT_MS = 20_000

/** Pauses before each extra round over the model list, used only when every model was busy. */
const BUSY_RETRY_DELAYS_MS = [2000, 5000]

export async function withModelFallback<T>(
  run: (model: string, attempt: { isLast: boolean }) => Promise<T>,
  { models = AI_MODELS, retryDelaysMs = BUSY_RETRY_DELAYS_MS } = {},
): Promise<T> {
  let lastError: unknown
  for (let round = 0; round <= retryDelaysMs.length; round++) {
    if (round > 0) await new Promise(resolve => setTimeout(resolve, retryDelaysMs[round - 1]))
    let allBusy = true
    for (const [i, model] of models.entries()) {
      try {
        return await run(model, { isLast: i === models.length - 1 })
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

export function generateContent(params: Omit<GenerateContentParameters, "model">, { timeoutMs = DEFAULT_MODEL_TIMEOUT_MS } = {}) {
  return withModelFallback((model, { isLast }) => ai.models.generateContent({
    ...params,
    model,
    config: isLast ? params.config : { ...params.config, httpOptions: { ...params.config?.httpOptions, timeout: timeoutMs } },
  }))
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
