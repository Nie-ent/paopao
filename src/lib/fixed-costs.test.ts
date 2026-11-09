import { describe, expect, it } from "vitest"
import { averageMonthlyIncome, fixedCostContext, monthlyAmount, suggestFixedCosts, summarizeFixedCosts, type FixedBill } from "./fixed-costs"

const bill = (over: Partial<FixedBill>): FixedBill => ({ name: "x", category: "Utilities", amount: 100, frequency: "MONTHLY", active: true, essential: true, ...over })
// 10:00 Bangkok, 15 Nov 2026
const now = new Date("2026-11-15T03:00:00Z")
const day = (iso: string) => new Date(`${iso}T05:00:00Z`)

describe("fixed costs", () => {
  it("turns any schedule into a monthly cost", () => {
    expect(monthlyAmount({ amount: 8500, frequency: "MONTHLY" })).toBe(8500)
    expect(monthlyAmount({ amount: 100, frequency: "WEEKLY" })).toBe(433.33)
    expect(monthlyAmount({ amount: 50, frequency: "DAILY" })).toBe(1520.83)
    expect(monthlyAmount({ amount: null, frequency: "MONTHLY" })).toBe(0)
  })

  it("sums essential and optional costs against income", () => {
    const s = summarizeFixedCosts([
      bill({ name: "ค่าเช่า", amount: 8500 }),
      bill({ name: "Netflix", amount: 419, essential: false }),
      bill({ name: "ยิม", amount: 1200, essential: false }),
      bill({ name: "ค่าไฟ", amount: null }),
      bill({ name: "เลิกแล้ว", amount: 999, active: false }),
    ], 25000)
    expect(s.total).toBe(10119)
    expect(s.essential).toBe(8500)
    expect(s.optional).toBe(1619)
    expect(s.withoutAmount).toBe(1)
    expect(s.percentOfIncome).toBe(40)
    expect(s.freeCash).toBe(14881)
    expect(s.items[0].name).toBe("ค่าเช่า")
    expect(summarizeFixedCosts([], null)).toMatchObject({ total: 0, avgIncome: null, freeCash: null, percentOfIncome: null })
  })

  it("averages income over the months the account has data for", () => {
    const incomes = [{ amount: 25000, date: day("2026-11-01") }, { amount: 25000, date: day("2026-10-01") }, { amount: 25000, date: day("2026-09-01") }]
    expect(averageMonthlyIncome(incomes, day("2026-01-01"), now)).toBe(25000)
    // A month-old account: one month of income is one month, not a third of one
    expect(averageMonthlyIncome([{ amount: 25000, date: day("2026-11-01") }], day("2026-10-16"), now)).toBe(25000)
    expect(averageMonthlyIncome([], day("2026-10-16"), now)).toBeNull()
    // Salary not in yet this month: average the months that have it
    expect(averageMonthlyIncome([{ amount: 30000, date: day("2026-09-28") }, { amount: 30000, date: day("2026-10-28") }], day("2026-01-01"), new Date("2026-11-10T03:00:00Z"))).toBe(30000)
    // Irregular income: a month with none counts as zero
    expect(averageMonthlyIncome([{ amount: 30000, date: day("2026-09-05") }, { amount: 30000, date: day("2026-11-05") }], day("2026-01-01"), now)).toBe(20000)
  })

  it("finds monthly payments that aren't listed, ignoring everyday spending and listed bills", () => {
    const exp = (note: string, amount: number, iso: string, category = "Entertainment") => ({ note, amount, date: day(iso), category })
    const rows = [
      exp("Netflix", 419, "2026-09-05"), exp("Netflix", 419, "2026-10-05"), exp("Netflix", 419, "2026-11-05"),
      exp("Spotify 129", 129, "2026-10-12"), exp("Spotify 129", 129, "2026-11-12"),
      // coffee: many times a month
      ...Array.from({ length: 20 }, (_, i) => exp("กาแฟ", 65, `2026-${i < 10 ? "10" : "11"}-${String((i % 10) + 1).padStart(2, "0")}`, "Food")),
      // only one month
      exp("ตั๋วคอนเสิร์ต", 2500, "2026-11-01"),
      // amounts all over the place
      exp("ช้อปปิ้ง", 300, "2026-10-03", "Shopping"), exp("ช้อปปิ้ง", 2900, "2026-11-03", "Shopping"),
      // already a bill
      exp("ค่าเน็ต", 599, "2026-10-20", "Utilities"), exp("ค่าเน็ต", 599, "2026-11-20", "Utilities"),
      // older than three months
      exp("Disney+", 289, "2026-06-01"), exp("Disney+", 289, "2026-07-01"),
    ]
    const s = suggestFixedCosts(rows, [{ name: "ค่าเน็ต", category: "Utilities", amount: 599 }], now)
    expect(s.map(x => x.name)).toEqual(["Netflix", "Spotify 129"])
    expect(s[0]).toMatchObject({ amount: 419, dayOfMonth: 5, months: 3, category: "Entertainment" })
  })

  it("describes fixed costs for the AI", () => {
    const s = summarizeFixedCosts([bill({ name: "ค่าเช่า", amount: 8500 }), bill({ name: "Netflix", amount: 419, essential: false })], 25000)
    const th = fixedCostContext(s, "th")
    expect(th).toContain("฿8,919")
    expect(th).toContain("Netflix ฿419 (ตัดได้)")
    expect(th).toContain("฿16,081")
    expect(fixedCostContext(summarizeFixedCosts([], null), "en")).toContain("No fixed costs")
  })
})
