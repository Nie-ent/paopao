import { AsyncLocalStorage } from "node:async_hooks"
import type { GenerateContentResponseUsageMetadata } from "@google/genai"
import type { AiFeature } from "@/lib/ai-features"

/**
 * Token usage of every successful Gemini call, for the admin analytics page (cost per feature,
 * per plan, per user). Prices are applied when reading, so a price change re-prices history
 * without touching rows.
 */

export { AI_FEATURE_LABELS, type AiFeature } from "@/lib/ai-features"

/**
 * Which user the AI calls in this async scope are for. Callers that know the user deep in the
 * stack (the LINE webhook, statement imports) set it once instead of threading it through every
 * AI helper. The store is mutable so a scope can open before the user is looked up.
 */
const scope = new AsyncLocalStorage<{ userId: string | null }>()

export function withAiUser<T>(userId: string | null, fn: () => T): T {
  return scope.run({ userId }, fn)
}

/** Sets the user for the current scope opened by withAiUser (no-op outside one). */
export function setAiUser(userId: string) {
  const store = scope.getStore()
  if (store) store.userId = userId
}

/** Input and output tokens as Gemini bills them: thinking tokens are charged as output. */
export function tokenCounts(usage: GenerateContentResponseUsageMetadata | undefined) {
  return {
    inputTokens: usage?.promptTokenCount ?? 0,
    outputTokens: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0),
  }
}

/** Saves one call's tokens. Never throws: analytics must not break the feature that used the AI. */
export async function recordAiUsage(model: string, feature: AiFeature | undefined, usage: GenerateContentResponseUsageMetadata | undefined, userId?: string | null) {
  const { inputTokens, outputTokens } = tokenCounts(usage)
  if (!inputTokens && !outputTokens) return
  try {
    // Imported here so code that only needs the AI helpers (and their tests) doesn't open a DB pool
    const { default: prisma } = await import("@/lib/db")
    await prisma.aiUsage.create({
      data: { userId: userId ?? scope.getStore()?.userId ?? null, feature: feature ?? "other", model, inputTokens, outputTokens },
    })
  } catch (error) {
    console.warn("[ai-usage] not recorded", (error as Error)?.message ?? error)
  }
}

/**
 * USD per 1M tokens (docs/costs.md, checked 9 Nov 2026). Flash doubles on 1 Jan 2027. A model not
 * listed here is priced as Flash, the most common case, so costs are never silently zero.
 */
const FLASH_PRICE_RISE = Date.UTC(2027, 0, 1)
export function aiPriceUsd(model: string, at: Date) {
  if (model.includes("lite")) return { input: 0.3, output: 2.5 }
  return at.getTime() < FLASH_PRICE_RISE ? { input: 0.75, output: 3.75 } : { input: 1.5, output: 7.5 }
}

export function aiCostUsd(model: string, at: Date, inputTokens: number, outputTokens: number) {
  const price = aiPriceUsd(model, at)
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000
}

/** docs/costs.md */
export const USD_TO_THB = 33.53
