import { describe, expect, it } from "vitest"
import type { messagingApi } from "@line/bot-sdk"
import { billQuestionCard, budgetTone, duplicateCard, friendInviteMessage, inviteCard, loginCard, morningBriefCard, proActivatedCard, recordedCard, summaryCard, summaryPickerCard, upsellCard } from "./line-cards"
import { buildSummary } from "./summary"
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

describe("summary cards", () => {
  const at = (iso: string) => new Date(iso)
  const txs = [
    { type: "INCOME", amount: 30000, date: at("2026-11-01T03:00:00Z"), category: { name: "Salary", color: "#10b981" } },
    ...Array.from({ length: 60 }, (_, i) => ({ type: "EXPENSE", amount: 50 + i, date: at(`2026-11-${String((i % 28) + 1).padStart(2, "0")}T05:00:00Z`), category: { name: ["Food", "Transport", "Shopping", "Utilities", "Entertainment"][i % 5], color: "#ef4444" } })),
  ]
  const now = at("2026-11-28T10:00:00Z")

  it("picker offers today, this month and this year as buttons and quick replies", () => {
    const msg = summaryPickerCard()
    expect(lineViolations(msg)).toEqual([])
    expect((msg.quickReply?.items ?? []).map(i => (i.action as { data: string }).data)).toEqual(["summary|DAY", "summary|MONTH", "summary|YEAR"])
  })

  it("every period renders within LINE's limits, including an empty one", () => {
    for (const period of ["DAY", "MONTH", "YEAR"] as const) {
      const msg = summaryCard(buildSummary(period, txs, now), URL)
      expect(lineViolations(msg), period).toEqual([])
      expect(msg.altText).toContain("รับ ฿30,000")
    }
    const empty = summaryCard(buildSummary("DAY", [], now), URL)
    expect(lineViolations(empty)).toEqual([])
    expect(empty.altText).toContain("ยังไม่มีรายการ")
  })

  it("the month chart has a bar per day; the year chart a pair of bars per month", () => {
    const month = JSON.stringify(summaryCard(buildSummary("MONTH", txs, now), URL).contents)
    expect(month).toContain("รายจ่ายรายวัน")
    const year = summaryCard(buildSummary("YEAR", txs, now), URL)
    expect(JSON.stringify(year.contents)).toContain("ม.ค.")
    expect(JSON.stringify(year.contents)).toContain("รายรับ vs รายจ่าย")
  })

  it("shows a negative balance in red with a minus sign", () => {
    const msg = summaryCard(buildSummary("DAY", [{ type: "EXPENSE", amount: 120, date: now, category: { name: "Food" } }], now), URL)
    expect(msg.altText).toContain("คงเหลือ −฿120")
  })
})

describe("invite cards", () => {
  const base = { link: "https://www.paopao-wallet.com/r/ABC123", rewarded: 1, maxRewards: 3, rewardDays: 30, friendTrialDays: 30, qualifyDays: 3, qualifyWindowDays: 14, progressUrl: "https://x/subscription#invite" }
  const uris = (m: unknown) => JSON.stringify(m).match(/"uri":"[^"]+"/g) ?? []

  it("sends the share button to the card share page when there is one", () => {
    expect(uris(inviteCard({ ...base, shareUrl: "https://liff.line.me/123/invite" }))).toContain('"uri":"https://liff.line.me/123/invite"')
    // Without LIFF: LINE's text share with the link
    expect(uris(inviteCard(base)).some(u => u.startsWith('"uri":"https://line.me/R/share?text='))).toBe(true)
  })

  it("builds the card friends receive: inviter, trial, and the invite link", () => {
    const m = friendInviteMessage({ link: base.link, inviterName: "Nie", friendTrialDays: 30 })
    expect(m.altText).toBe("Nie ชวนคุณใช้เป๋าเป๋า รับ Pro ฟรี 30 วัน")
    const json = JSON.stringify(m)
    expect(json).toContain("Nie ชวนคุณมาใช้เป๋าเป๋า")
    expect(json).toContain("/line/invite-hero.jpg")
    expect(uris(m).every(u => u === `"uri":"${base.link}"` || u.includes("invite-hero"))).toBe(true)
    expect(friendInviteMessage({ link: base.link, inviterName: "  ", friendTrialDays: 30 }).altText).toMatch(/^เพื่อนของคุณ ชวนคุณ/)
    expect(lineViolations(m)).toEqual([])
    expect(lineViolations(inviteCard({ ...base, shareUrl: "https://liff.line.me/123/invite" }))).toEqual([])
  })
})
