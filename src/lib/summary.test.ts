import { describe, expect, it } from "vitest"
import { buildSummary, encodeSummaryAnswer, isSummaryRequest, parseSummaryAnswer, summaryRange } from "./summary"

// 01:00 Bangkok on 1 Dec 2026 = 18:00 UTC on 30 Nov
const now = new Date("2026-11-30T18:00:00Z")
const tx = (type: string, amount: number, iso: string, name = "Food", color: string | null = "#ef4444") =>
  ({ type, amount, date: new Date(iso), category: { name, color } })

describe("summaryRange (Bangkok)", () => {
  it("day, month and year start at Bangkok midnight", () => {
    expect(summaryRange("DAY", now)).toEqual({ gte: new Date("2026-11-30T17:00:00Z"), lt: new Date("2026-12-01T17:00:00Z") })
    expect(summaryRange("MONTH", now)).toEqual({ gte: new Date("2026-11-30T17:00:00Z"), lt: new Date("2026-12-31T17:00:00Z") })
    expect(summaryRange("YEAR", now)).toEqual({ gte: new Date("2025-12-31T17:00:00Z"), lt: new Date("2026-12-31T17:00:00Z") })
  })
})

describe("buildSummary", () => {
  it("totals and net", () => {
    const s = buildSummary("DAY", [tx("INCOME", 1000, "2026-11-30T20:00:00Z", "Salary"), tx("EXPENSE", 65, "2026-11-30T20:00:00Z"), tx("EXPENSE", 35, "2026-11-30T21:00:00Z")], now)
    expect(s).toMatchObject({ income: 1000, expense: 100, net: 900, count: 3, buckets: [] })
    expect(s.title).toBe("1 ธ.ค. 2569")
  })

  it("month buckets by Bangkok day; an entry at 01:00 Bangkok counts on that day", () => {
    const s = buildSummary("MONTH", [tx("EXPENSE", 50, "2026-11-30T18:00:00Z"), tx("EXPENSE", 20, "2026-12-15T05:00:00Z")], now)
    expect(s.buckets).toHaveLength(31)
    expect(s.buckets[0]).toMatchObject({ label: "1", expense: 50 })
    expect(s.buckets[14].expense).toBe(20)
    expect(s.title).toBe("ธันวาคม 2569")
  })

  it("year buckets are 12 Thai months with income and expense", () => {
    const s = buildSummary("YEAR", [tx("INCOME", 3000, "2026-03-10T05:00:00Z", "Salary"), tx("EXPENSE", 400, "2026-03-11T05:00:00Z")], now)
    expect(s.buckets.map(b => b.label)).toEqual(["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."])
    expect(s.buckets[2]).toMatchObject({ income: 3000, expense: 400 })
    expect(s.title).toBe("ปี 2569")
  })

  it("top expense categories, largest first; income excluded", () => {
    const s = buildSummary("DAY", [tx("EXPENSE", 10, "2026-11-30T20:00:00Z", "Transport"), tx("EXPENSE", 90, "2026-11-30T20:00:00Z", "Food"), tx("INCOME", 999, "2026-11-30T20:00:00Z", "Salary")], now)
    expect(s.topCategories.map(c => c.name)).toEqual(["Food", "Transport"])
  })
})

describe("summary request and answers", () => {
  it("recognises the words that open the picker", () => {
    for (const t of ["สรุป", " สรุปยอด ", "summary", "Report"]) expect(isSummaryRequest(t)).toBe(true)
    for (const t of ["สรุปกาแฟ 65", "กาแฟ 65", ""]) expect(isSummaryRequest(t)).toBe(false)
  })
  it("round-trips the postback and rejects anything else", () => {
    expect(parseSummaryAnswer(encodeSummaryAnswer("YEAR"))).toBe("YEAR")
    for (const d of ["summary|WEEK", "summary", "bill|x|2026-01-01|other", "summary|DAY|x", ""]) {
      expect(parseSummaryAnswer(d), d).toBeNull()
    }
  })
})
