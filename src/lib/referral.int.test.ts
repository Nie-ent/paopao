/**
 * Referral flow against a real database. Skipped unless REFERRAL_TEST_DB points at a throwaway
 * database with the migrations applied (never production):
 *   REFERRAL_TEST_DB=postgresql://… npx vitest run src/lib/referral.int.test.ts
 */
import { beforeAll, describe, expect, it, vi } from "vitest"

const url = process.env.REFERRAL_TEST_DB
const DAY = 24 * 60 * 60 * 1000

describe.skipIf(!url)("referrals (database)", () => {
  let prisma: typeof import("./db").default, ref: typeof import("./referral")
  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", url!)
    prisma = (await import("./db")).default
    ref = await import("./referral")
    await prisma.referral.deleteMany({})
    await prisma.transaction.deleteMany({ where: { user: { lineId: { startsWith: "Uref" } } } })
    await prisma.subscriptionPayment.deleteMany({ where: { user: { lineId: { startsWith: "Uref" } } } })
    await prisma.user.deleteMany({ where: { lineId: { startsWith: "Uref" } } })
  })

  const user = (lineId: string, createdAt = new Date()) => prisma.user.create({ data: { lineId, name: `${lineId} Name`, createdAt } })
  const logOn = async (userId: string, times: Date[]) => {
    const cat = await prisma.category.upsert({ where: { id: "ref-cat" }, create: { id: "ref-cat", name: "Food", type: "EXPENSE" }, update: {} })
    for (const t of times) await prisma.transaction.create({ data: { userId, type: "EXPENSE", amount: 10, categoryId: cat.id, date: t, createdAt: t } })
  }

  it("links a brand-new account and gives it the longer trial; refuses self, old and repeat sign-ups", async () => {
    const inviter = await user("Uref-inviter")
    const code = await ref.ensureReferralCode(inviter.id)
    expect(await ref.ensureReferralCode(inviter.id)).toBe(code) // stable

    const friend = await user("Uref-friend1")
    expect(await ref.attachReferral(friend, code)).toBe("ATTACHED")
    const f = await prisma.user.findUniqueOrThrow({ where: { id: friend.id } })
    expect(f.subscriptionTier).toBe("PRO")
    expect(Math.round((f.proExpiresAt!.getTime() - Date.now()) / DAY)).toBe(ref.REFERRAL_TRIAL_DAYS)

    expect(await ref.attachReferral(friend, code)).toBe("ALREADY_REFERRED")
    expect(await ref.attachReferral(inviter, code)).toBe("SELF")
    expect(await ref.attachReferral(await user("Uref-old", new Date(Date.now() - 3 * DAY)), code)).toBe("NOT_NEW")
    expect(await ref.attachReferral(await user("Uref-nocode"), "ZZZZZZZZ")).toBe("INVALID_CODE")
  })

  it("rewards the inviter once a friend logs on 3 days, up to 3 friends, and expires the rest", async () => {
    const inviter = await prisma.user.findUniqueOrThrow({ where: { lineId: "Uref-inviter" } })
    const code = inviter.referralCode!
    const start = new Date(Date.now() - 20 * DAY)
    // Five more friends signed up 20 days ago (backdated referrals)
    const friends = [await prisma.user.findUniqueOrThrow({ where: { lineId: "Uref-friend1" } })]
    for (let i = 2; i <= 6; i++) friends.push(await user(`Uref-friend${i}`))
    await prisma.referral.updateMany({ where: { referrerId: inviter.id }, data: { createdAt: start } })
    for (const fr of friends.slice(1)) await prisma.referral.create({ data: { referrerId: inviter.id, refereeId: fr.id, createdAt: start } })

    // friends 1–4 log on 3 days in time; friend 5 only on 2 days; friend 6 on 3 days but too late
    for (const fr of friends.slice(0, 4)) await logOn(fr.id, [1, 2, 5].map(d => new Date(start.getTime() + d * DAY)))
    await logOn(friends[4].id, [1, 2].map(d => new Date(start.getTime() + d * DAY)))
    await logOn(friends[5].id, [15, 16, 17].map(d => new Date(start.getTime() + d * DAY)))

    const before = Date.now()
    const res = await ref.processReferrals()
    expect(res.qualified).toBe(4)
    expect(res.rewarded).toHaveLength(3) // the 4th is past the limit
    expect(res.expired).toBe(2)

    const inv = await prisma.user.findUniqueOrThrow({ where: { id: inviter.id } })
    expect(inv.subscriptionTier).toBe("PRO")
    expect(Math.round((inv.proExpiresAt!.getTime() - before) / DAY)).toBe(3 * ref.REWARD_DAYS)

    // Settled once: running again changes nothing
    const again = await ref.processReferrals()
    expect(again.checked).toBe(0)

    const summary = await ref.referralSummary(inviter.id)
    expect(summary.rewardedCount).toBe(3)
    expect(summary.friends.map(f => f.status).sort()).toEqual(["EXPIRED", "EXPIRED", "QUALIFIED", "QUALIFIED", "QUALIFIED", "QUALIFIED"])
    expect(summary.friends.every(f => !f.name.includes(" "))).toBe(true) // first names only
    void code
  })
})
