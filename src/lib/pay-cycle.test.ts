import { describe, expect, it } from "vitest"
import { cycleFor, currentCycle, dailyAllowance, daysLeft, previousCycle, suggestPayday, upcomingBills } from "./pay-cycle"

// Bangkok midnight of a day, as UTC
const bkk = (y: number, m: number, d: number, h = 0) => new Date(Date.UTC(y, m - 1, d, h) - 7 * 3600_000)
const day = (date: Date) => new Date(date.getTime() + 7 * 3600_000).toISOString().slice(0, 10)

describe("cycles", () => {
  it("without a payday a cycle is the calendar month", () => {
    const c = cycleFor(null, 2026, 10)
    expect([day(c.gte), day(c.lt)]).toEqual(["2026-11-01", "2026-12-01"])
  })

  it("payday 25: November is 25 Oct – 24 Nov", () => {
    const c = cycleFor(25, 2026, 10)
    expect([day(c.gte), day(c.lt)]).toEqual(["2026-10-25", "2026-11-25"])
  })

  it("payday 5: November is 5 Nov – 4 Dec", () => {
    const c = cycleFor(5, 2026, 10)
    expect([day(c.gte), day(c.lt)]).toEqual(["2026-11-05", "2026-12-05"])
  })

  it("payday 31 falls on the month's last day", () => {
    const c = cycleFor(31, 2026, 2) // March: 28 Feb – 30 Mar
    expect([day(c.gte), day(c.lt)]).toEqual(["2026-02-28", "2026-03-31"])
  })

  it("finds the current cycle, across a year boundary too", () => {
    expect(currentCycle(25, bkk(2026, 11, 10, 9))).toMatchObject({ year: 2026, month: 10 })
    expect(currentCycle(25, bkk(2026, 11, 26, 9))).toMatchObject({ year: 2026, month: 11 })
    const jan = currentCycle(25, bkk(2026, 12, 27, 9))
    expect([jan.year, jan.month, day(jan.gte)]).toEqual([2027, 0, "2026-12-25"])
  })

  it("the previous cycle and the days left", () => {
    const c = currentCycle(25, bkk(2026, 11, 20, 15))
    expect(day(previousCycle(25, c).gte)).toBe("2026-09-25")
    expect(daysLeft(c, bkk(2026, 11, 20, 15))).toBe(5) // 20, 21, 22, 23, 24
  })
})

describe("suggestPayday", () => {
  const salary = (y: number, m: number, d: number, amount = 30000) => ({ date: bkk(y, m, d, 10), amount })
  it("finds the usual day of the biggest income", () => {
    expect(suggestPayday([salary(2026, 8, 25), salary(2026, 9, 25), salary(2026, 10, 24), { date: bkk(2026, 10, 3), amount: 500 }])).toBe(25)
  })
  it("says nothing without a pattern or enough months", () => {
    expect(suggestPayday([salary(2026, 10, 25)])).toBeNull()
    expect(suggestPayday([salary(2026, 8, 3), salary(2026, 9, 17), salary(2026, 10, 28)])).toBeNull()
  })
})

describe("allowance", () => {
  it("counts bills still due before the cycle ends, skipping ones already recorded", () => {
    const c = cycleFor(25, 2026, 10) // ends 25 Nov
    const bills = [
      { id: "rent", amount: 8000, frequency: "MONTHLY" as const, dayOfWeek: null, dayOfMonth: 22, active: true },
      { id: "net", amount: 600, frequency: "MONTHLY" as const, dayOfWeek: null, dayOfMonth: 20, active: true },
      { id: "old", amount: 99, frequency: "MONTHLY" as const, dayOfWeek: null, dayOfMonth: 5, active: true },
    ]
    expect(upcomingBills(bills, c, new Set(["net|2026-11-20"]), bkk(2026, 11, 18, 9))).toBe(8000)
  })

  it("spreads what's left over the days, or reports a shortfall", () => {
    expect(dailyAllowance(10000, 4000, 10)).toEqual({ perDay: 600, spare: 6000, shortfall: 0 })
    expect(dailyAllowance(3000, 4000, 10)).toEqual({ perDay: 0, spare: -1000, shortfall: 1000 })
  })
})
