import { describe, expect, it } from "vitest"
import type { messagingApi } from "@line/bot-sdk"
import { billQuestionCard, budgetTone, duplicateCard, loginCard, morningBriefCard, proActivatedCard, recordedCard, upsellCard } from "./line-cards"
import { buildBillQuestion } from "./bills"

/** Walks a Flex message and returns every violation of LINE's documented limits. */
function lineViolations(msg: messagingApi.FlexMessage) {
  const problems: string[] = []
  if (!msg.altText || msg.altText.length > 400) problems.push(`altText length ${msg.altText?.length}`)
  const size = Buffer.byteLength(JSON.stringify(msg.contents))
  if (size > 30_000) problems.push(`bubble ${size} bytes > 30KB`)
  const walk = (node: unknown, path: string) => {
    if (!node || typeof node !== "object") return
    const n = node as Record<string, unknown>
    if (n.type === "text" && (typeof n.text !== "string" || n.text.length === 0)) problems.push(`${path}: empty text`)
    for (const key of ["color", "backgroundColor"]) {
      if (n[key] !== undefined && !/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(String(n[key]))) problems.push(`${path}.${key} = ${n[key]}`)
    }
    if (n.action && typeof n.action === "object") {
      const a = n.action as Record<string, unknown>
      if (typeof a.label === "string" && a.label.length > 40) problems.push(`${path}: label > 40`)
      if (a.type === "uri" && !/^https:\/\//.test(String(a.uri))) problems.push(`${path}: uri not https: ${a.uri}`)
      if (a.type === "postback" && String(a.data).length > 300) problems.push(`${path}: postback data > 300`)
    }
    for (const [k, v] of Object.entries(n)) {
      if (Array.isArray(v)) v.forEach((c, i) => walk(c, `${path}.${k}[${i}]`))
      else if (v && typeof v === "object") walk(v, `${path}.${k}`)
    }
  }
  walk(msg.contents, "contents")
  return problems
}

const now = new Date("2026-11-08T05:00:00Z")
const URL = "https://liff.line.me/1234567890-abc"

describe("recordedCard", () => {
  it("one item: Thai category, signed amount, dashboard button", () => {
    const msg = recordedCard({ items: [{ type: "EXPENSE", amount: 65, category: "Food", categoryColor: "#ef4444", note: "กาแฟ" }], dashboardUrl: URL, now })
    expect(lineViolations(msg)).toEqual([])
    expect(msg.altText).toBe("บันทึกแล้ว: อาหาร −฿65")
    const json = JSON.stringify(msg.contents)
    expect(json).toContain("อาหาร")
    expect(json).toContain("−฿65")
    expect(json).toContain(URL)
  })

  it("several items show totals; income in green, expenses in red", () => {
    const msg = recordedCard({ items: [
      { type: "EXPENSE", amount: 50, category: "Food" }, { type: "EXPENSE", amount: 35, category: "Food" }, { type: "INCOME", amount: 1000, category: "Salary" },
    ], dashboardUrl: URL, now })
    expect(lineViolations(msg)).toEqual([])
    expect(msg.altText).toBe("บันทึกแล้ว 3 รายการ รวมจ่าย ฿85 รวมรับ ฿1,000")
    expect(JSON.stringify(msg.contents)).toContain("รวมรายจ่าย")
  })

  it("budget callout from 50%, with a bar that never overflows", () => {
    expect(budgetTone(40)).toBeNull()
    expect(budgetTone(55)?.tone).toBe("info")
    expect(budgetTone(85)?.tone).toBe("warn")
    expect(budgetTone(140)?.tone).toBe("danger")
    const msg = recordedCard({ items: [{ type: "EXPENSE", amount: 5, category: "Food" }], dashboardUrl: URL, now, budgetRatio: 140 })
    expect(lineViolations(msg)).toEqual([])
    expect(JSON.stringify(msg.contents)).toContain('"width":"100%"')
  })

  it("shows extra notices as warning boxes", () => {
    const msg = recordedCard({ items: [{ type: "EXPENSE", amount: 59, category: "Other Expense" }], dashboardUrl: URL, now, notices: ["ยอดตรงกับค่า Pro แต่บัญชีผู้รับไม่ตรง"] })
    expect(lineViolations(msg)).toEqual([])
    expect(JSON.stringify(msg.contents)).toContain("บัญชีผู้รับไม่ตรง")
  })

  it("a long batch stays within LINE's size limit", () => {
    const items = Array.from({ length: 40 }, (_, i) => ({ type: "EXPENSE" as const, amount: i + 1, category: "Shopping", note: "รายการยาวมาก ".repeat(10) }))
    const msg = recordedCard({ items, dashboardUrl: URL, now, duplicates: [{ date: now, amount: 99 }] })
    expect(lineViolations(msg)).toEqual([])
    expect(JSON.stringify(msg.contents)).toContain("และอีก 30 รายการ")
  })

  it("empty notes and unknown categories don't produce empty text", () => {
    const msg = recordedCard({ items: [{ type: "INCOME", amount: 1, category: "My Side Gig", note: "" }], dashboardUrl: URL, now })
    expect(lineViolations(msg)).toEqual([])
  })
})

describe("other cards", () => {
  it("duplicate, Pro, upsell, login, morning brief, bills are all valid", () => {
    const cards = [
      duplicateCard([{ date: now, amount: 120 }]),
      proActivatedCard({ expiresAt: now, kind: "YEARLY", billsUrl: URL, plansUrl: URL }),
      proActivatedCard({ expiresAt: now, kind: "TRIAL", billsUrl: URL, plansUrl: URL }),
      upsellCard({ wasOtherSlip: true, trialEligible: true, trialDays: 14, monthly: { priceThb: 59, days: 30 }, yearlyThb: 590, plansUrl: URL }),
      upsellCard({ wasOtherSlip: false, trialEligible: false, trialDays: 14, monthly: { priceThb: 59, days: 30 }, yearlyThb: 590, plansUrl: URL }),
      loginCard(URL, "https://www.paopao-wallet.com/login"),
      morningBriefCard([{ type: "EXPENSE", amount: 120, category: { name: "Food", color: "#ef4444" } }, { type: "INCOME", amount: 500, category: { name: "Salary" } }], now, URL),
      morningBriefCard([], now, URL),
      buildBillQuestion([{ id: "a", name: "ค่าไฟ", amount: 850 }, { id: "b", name: "ค่าเน็ต", amount: null }], now, URL),
    ]
    for (const c of cards) expect(lineViolations(c), c.altText).toEqual([])
  })

  it("the trial button sends the trial keyword only when eligible", () => {
    const eligible = JSON.stringify(upsellCard({ wasOtherSlip: false, trialEligible: true, trialDays: 14, monthly: { priceThb: 59, days: 30 }, yearlyThb: 590, plansUrl: URL }).contents)
    const notEligible = JSON.stringify(upsellCard({ wasOtherSlip: false, trialEligible: false, trialDays: 14, monthly: { priceThb: 59, days: 30 }, yearlyThb: 590, plansUrl: URL }).contents)
    expect(eligible).toContain('"text":"ทดลองใช้"')
    expect(notEligible).not.toContain('"text":"ทดลองใช้"')
  })

  it("morning brief card numbers match the text brief", () => {
    const msg = morningBriefCard([{ type: "EXPENSE", amount: 120, category: { name: "Food" } }], now, URL)
    expect(msg.altText).toContain("ใช้ไป ฿120")
    expect(JSON.stringify(msg.contents)).toContain("อาหาร")
  })

  it("bill card buttons are postbacks with the same data as the quick replies", () => {
    const msg = buildBillQuestion([{ id: "a", name: "ค่าไฟ", amount: 850 }], now, URL)
    const q = msg.quickReply?.items?.[0]?.action as { data: string }
    expect(JSON.stringify(msg.contents)).toContain(`"data":"${q.data}"`)
    expect(billQuestionCard).toBeTypeOf("function")
  })
})
