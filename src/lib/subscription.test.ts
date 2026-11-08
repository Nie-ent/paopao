import { describe, expect, it } from "vitest"
import { effectivePlan, extendProExpiry, isProActive, isTrialEligible, planForAmount } from "./subscription"

const now = new Date("2026-11-08T05:00:00Z")
const days = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000)

describe("isProActive", () => {
  it("is Pro only while the paid period lasts", () => {
    expect(isProActive({ subscriptionTier: "PRO", proExpiresAt: days(1) }, now)).toBe(true)
    expect(isProActive({ subscriptionTier: "PRO", proExpiresAt: days(-1) }, now)).toBe(false)
  })

  it("a PRO tier without an expiry date is not Pro", () => {
    expect(isProActive({ subscriptionTier: "PRO", proExpiresAt: null }, now)).toBe(false)
  })

  it("Free is never Pro", () => {
    expect(effectivePlan({ subscriptionTier: "FREE", proExpiresAt: days(10) }, now)).toBe("FREE")
  })
})

describe("extendProExpiry", () => {
  it("starts 30 days from now when there is no active period", () => {
    expect(extendProExpiry(null, now)).toEqual(days(30))
    expect(extendProExpiry(days(-5), now)).toEqual(days(30))
  })

  it("adds the period on top of one that is still running (early renewal is not lost)", () => {
    expect(extendProExpiry(days(10), now)).toEqual(days(40))
    expect(extendProExpiry(days(10), now, 365)).toEqual(days(375))
  })
})

describe("planForAmount", () => {
  it("maps exact plan prices", () => {
    expect(planForAmount(59)).toBe("MONTHLY")
    expect(planForAmount(590)).toBe("YEARLY")
  })
  it("rejects anything else", () => {
    expect(planForAmount(58.99)).toBeNull()
    expect(planForAmount(5900)).toBeNull()
  })
})

describe("isTrialEligible", () => {
  const free = { subscriptionTier: "FREE", proExpiresAt: null, trialStartedAt: null }
  it("only for accounts that never trialled or paid", () => {
    expect(isTrialEligible(free, false, now)).toBe(true)
    expect(isTrialEligible({ ...free, trialStartedAt: days(-30) }, false, now)).toBe(false)
    expect(isTrialEligible(free, true, now)).toBe(false)
  })
  it("not while Pro is active", () => {
    expect(isTrialEligible({ subscriptionTier: "PRO", proExpiresAt: days(5), trialStartedAt: null }, false, now)).toBe(false)
  })
})
