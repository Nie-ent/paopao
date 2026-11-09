import { describe, expect, it } from "vitest"
import { isReferralCode, qualifyingDays, referralRewardText } from "./referral"

const at = (iso: string) => new Date(iso)

describe("referral rules", () => {
  it("accepts only well-formed invite codes", () => {
    expect(isReferralCode("ABCD2345")).toBe(true)
    for (const bad of ["abcd2345", "ABCD234", "ABCD23456", "ABCD0O1I", "", null, "ABCD-234"]) expect(isReferralCode(bad), String(bad)).toBe(false)
  })

  it("counts distinct Bangkok days inside the 14-day window", () => {
    const signedUp = at("2026-11-01T03:00:00Z") // 10:00 Bangkok
    const entries = [
      at("2026-11-01T04:00:00Z"), at("2026-11-01T10:00:00Z"), // same Bangkok day twice
      at("2026-11-01T17:30:00Z"), // 00:30 on 2 Nov in Bangkok
      at("2026-11-14T02:00:00Z"), // day 13, inside
      at("2026-11-15T03:00:00Z"), // exactly 14 days later: outside
      at("2026-10-31T03:00:00Z"), // before signing up: outside
    ]
    expect(qualifyingDays(entries, signedUp)).toBe(3)
    expect(qualifyingDays(entries.slice(0, 3), signedUp)).toBe(2)
  })

  it("tells the inviter how many invites are left", () => {
    expect(referralRewardText(at("2026-12-09T03:00:00Z"), 1)).toMatch(/Pro ฟรี 30 วัน[\s\S]*ชวนได้อีก 2 คน/)
    expect(referralRewardText(at("2026-12-09T03:00:00Z"), 3)).toMatch(/ครบ 3 ครั้ง/)
  })
})

describe("invite command", () => {
  it("recognises the ways people ask for their invite link", async () => {
    const { isInviteRequest } = await import("./referral")
    for (const t of ["ชวนเพื่อน", "แนะนำเพื่อน", " invite ", "Referral", "ชวนเพื่อนรับ pro"]) expect(isInviteRequest(t), t).toBe(true)
    for (const t of ["ชวนเพื่อนกินข้าว 120", "กาแฟ 65", "invite 50"]) expect(isInviteRequest(t), t).toBe(false)
  })
})
