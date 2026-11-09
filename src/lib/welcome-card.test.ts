import { describe, expect, it } from "vitest"
import { welcomeCard } from "./line-cards"

const base = { trialDays: 14, dashboardUrl: "https://liff.line.me/x" }
const json = (m: unknown) => JSON.stringify(m)

describe("welcome card", () => {
  it("greets by first name and explains the three steps with a try-it button", () => {
    const c = welcomeCard({ ...base, name: "สมชาย ใจดี", proUntil: null, trialEligible: true })
    const s = json(c)
    expect(s).toContain("สวัสดีครับคุณสมชาย")
    expect(s).toContain("พิมพ์รายการกับยอดเงิน")
    expect(s).toContain("ตรวจการ์ดแล้วแตะบันทึก")
    expect(s).toContain('"text":"กาแฟ 65"') // the try-it button sends a sample entry
    expect(s).toContain("ทดลองใช้ Pro ฟรี 14 วัน".slice(0, 6))
    expect(c.quickReply!.items!.map(i => (i.action as { label: string }).label)).toEqual(["สรุป", "ส่งสลิป", "ทดลองใช้ Pro", "ชวนเพื่อน"])
  })

  it("tells a referred friend their Pro is already on, and doesn't offer the trial", () => {
    const c = welcomeCard({ ...base, name: "Nie", proUntil: new Date("2026-12-09T00:00:00Z"), trialEligible: false })
    expect(json(c)).toContain("คุณใช้ Pro ได้ถึง")
    expect(c.quickReply!.items!.map(i => (i.action as { label: string }).label)).not.toContain("ทดลองใช้ Pro")
  })

  it("works without a profile name", () => {
    expect(json(welcomeCard({ ...base, name: "LINE User", proUntil: null, trialEligible: false }))).toContain("สวัสดีครับ 👋")
  })
})
