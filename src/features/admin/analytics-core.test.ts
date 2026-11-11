import { describe, expect, it } from "vitest"
import { activeDaysHistogram, activeUserSeries, lastDays, mrr, planSegment, proGrantsByWeek, trialConversion, weeklyRetention } from "./analytics-core"

// Wednesday 11 Nov 2026, 12:00 Bangkok
const now = new Date("2026-11-11T05:00:00Z")
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000)
const pro = (expiresInDays: number, trialDaysAgo: number | null = null) => ({
  subscriptionTier: "PRO", proExpiresAt: daysAgo(-expiresInDays), trialStartedAt: trialDaysAgo == null ? null : daysAgo(trialDaysAgo),
})
const none = { invited: false, rewardedAt: [] as Date[] }

describe("planSegment", () => {
  it("separates never-Pro from lapsed Free users", () => {
    expect(planSegment({ subscriptionTier: "FREE", proExpiresAt: null, trialStartedAt: null }, [], none, now)).toBe("free")
    expect(planSegment({ subscriptionTier: "PRO", proExpiresAt: daysAgo(3), trialStartedAt: daysAgo(17) }, [], none, now)).toBe("free_lapsed")
  })

  it("counts a payment still in its own period as paid, even during a trial", () => {
    expect(planSegment(pro(20, 5), [{ plan: "MONTHLY", createdAt: daysAgo(2) }], none, now)).toBe("paid")
  })

  it("tells normal trials, invited trials and referral rewards apart", () => {
    expect(planSegment(pro(10, 4), [], none, now)).toBe("trial")
    expect(planSegment(pro(25, 5), [], { invited: true, rewardedAt: [] }, now)).toBe("invite_trial")
    expect(planSegment(pro(20, 40), [], { invited: false, rewardedAt: [daysAgo(10)] }, now)).toBe("referral_reward")
  })

  it("falls back to paid for stacked time, then to an admin grant", () => {
    expect(planSegment(pro(20), [{ plan: "MONTHLY", createdAt: daysAgo(40) }], none, now)).toBe("paid")
    expect(planSegment(pro(20), [], none, now)).toBe("other")
  })
})

describe("revenue", () => {
  it("MRR counts monthly payments in full and yearly ones as a twelfth while in period", () => {
    const payments = [
      { plan: "MONTHLY", amount: 59, createdAt: daysAgo(10) },
      { plan: "MONTHLY", amount: 59, createdAt: daysAgo(31) }, // ended
      { plan: "YEARLY", amount: 590, createdAt: daysAgo(200) },
    ]
    expect(mrr(payments, now)).toBeCloseTo(59 + 590 / 12)
  })

  it("trial conversion only counts trials that have ended, with the longer invited trial", () => {
    const result = trialConversion([
      { trialStartedAt: daysAgo(20), invited: false, payments: [{ plan: "MONTHLY", createdAt: daysAgo(6) }] },
      { trialStartedAt: daysAgo(20), invited: false, payments: [] },
      { trialStartedAt: daysAgo(20), invited: true, payments: [] }, // 30-day trial still running
      { trialStartedAt: null, invited: false, payments: [] },
    ], now)
    expect(result).toEqual({ ended: 2, paid: 1, rate: 0.5 })
  })
})

describe("activity", () => {
  const days = lastDays(10, now)

  it("lastDays ends today in Bangkok", () => {
    expect(days.at(-1)).toBe("2026-11-11")
    expect(days[0]).toBe("2026-11-02")
  })

  it("DAU, WAU and MAU count distinct users over trailing windows", () => {
    const activity = [
      { userId: "a", day: "2026-11-11" },
      { userId: "b", day: "2026-11-11" },
      { userId: "a", day: "2026-11-09" },
      { userId: "c", day: "2026-11-03" },
    ]
    const series = activeUserSeries(activity, days)
    expect(series.at(-1)).toEqual({ day: "2026-11-11", dau: 2, wau: 2, mau: 3 })
    expect(series.find(s => s.day === "2026-11-09")).toMatchObject({ dau: 1, wau: 2 })
  })

  it("buckets users by how many days they were active", () => {
    const activity = [
      ...["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"].map(day => ({ userId: "a", day })),
      { userId: "b", day: "2026-11-05" },
      { userId: "c", day: "2026-10-01" }, // outside the window
    ]
    const hist = activeDaysHistogram(activity, lastDays(30, now))
    expect(hist.map(h => h.users)).toEqual([1, 0, 1, 0, 0])
  })

  it("weekly retention groups signups by Monday week and leaves future weeks empty", () => {
    const users = [
      { id: "a", createdAt: new Date("2026-11-02T03:00:00Z") }, // Mon 2 Nov
      { id: "b", createdAt: new Date("2026-11-04T03:00:00Z") }, // Wed 4 Nov, same week
    ]
    const activity = [
      { userId: "a", day: "2026-11-02" },
      { userId: "b", day: "2026-11-05" },
      { userId: "a", day: "2026-11-10" }, // next week
    ]
    const rows = weeklyRetention(users, activity, { now, cohorts: 2, weeks: 3 })
    expect(rows[0]).toEqual({ cohort: "2026-11-02", size: 2, rates: [1, 0.5, null] })
    expect(rows[1]).toEqual({ cohort: "2026-11-09", size: 0, rates: [null, null, null] })
  })
})

describe("proGrantsByWeek", () => {
  it("counts new Pro time per Monday week by source", () => {
    const rows = proGrantsByWeek([
      { source: "trial", at: new Date("2026-11-09T03:00:00Z") }, // Mon this week
      { source: "invite_trial", at: new Date("2026-11-11T03:00:00Z") },
      { source: "paid", at: new Date("2026-11-08T03:00:00Z") }, // Sun last week
      { source: "referral_reward", at: new Date("2026-01-01T03:00:00Z") }, // too old
    ], { now, weeks: 2 })
    expect(rows).toEqual([
      { week: "2026-11-02", paid: 1, trial: 0, invite_trial: 0, referral_reward: 0 },
      { week: "2026-11-09", paid: 0, trial: 1, invite_trial: 1, referral_reward: 0 },
    ])
  })
})
