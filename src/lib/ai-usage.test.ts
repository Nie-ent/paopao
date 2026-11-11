import { describe, expect, it } from "vitest"
import { aiCostUsd, tokenCounts } from "./ai-usage"

describe("ai usage", () => {
  it("bills thinking tokens as output", () => {
    expect(tokenCounts({ promptTokenCount: 500, candidatesTokenCount: 200, thoughtsTokenCount: 100 })).toEqual({ inputTokens: 500, outputTokens: 300 })
    expect(tokenCounts(undefined)).toEqual({ inputTokens: 0, outputTokens: 0 })
  })

  it("prices Flash higher from 2027 and Lite at its own rate", () => {
    const before = new Date("2026-12-31T12:00:00Z")
    const after = new Date("2027-01-01T12:00:00Z")
    expect(aiCostUsd("gemini-3.8-flash", before, 1_000_000, 1_000_000)).toBeCloseTo(4.5)
    expect(aiCostUsd("gemini-3.8-flash", after, 1_000_000, 1_000_000)).toBeCloseTo(9)
    expect(aiCostUsd("gemini-3.5-flash-lite", after, 1_000_000, 1_000_000)).toBeCloseTo(2.8)
  })
})
