/**
 * The free Pro trial can only be started once per account, against a real database. Skipped
 * unless TEST_DATABASE_URL points at a throwaway database with the migrations applied:
 *   TEST_DATABASE_URL=postgresql://… npx vitest run src/lib/trial.int.test.ts
 */
import { beforeAll, describe, expect, it, vi } from "vitest"

const url = process.env.TEST_DATABASE_URL
const DAY = 24 * 60 * 60 * 1000

describe.skipIf(!url)("free Pro trial (database)", () => {
  let prisma: typeof import("./db").default, startProTrial: typeof import("./trial").startProTrial
  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", url!)
    prisma = (await import("./db")).default
    startProTrial = (await import("./trial")).startProTrial
    await prisma.subscriptionPayment.deleteMany({ where: { user: { lineId: { startsWith: "Utrial" } } } })
    await prisma.user.deleteMany({ where: { lineId: { in: ["demo"] } } })
    await prisma.user.deleteMany({ where: { lineId: { startsWith: "Utrial" } } })
  })

  it("20 simultaneous requests start exactly one trial", async () => {
    const u = await prisma.user.create({ data: { lineId: "Utrial-race" } })
    const results = await Promise.all(Array.from({ length: 20 }, () => startProTrial(u.id)))
    expect(results.filter(Boolean)).toHaveLength(1)
    const after = await prisma.user.findUniqueOrThrow({ where: { id: u.id } })
    expect(Math.round((after.proExpiresAt!.getTime() - Date.now()) / DAY)).toBe(14) // not 20 × 14
  })

  it("never again: not during the trial, not after it ends", async () => {
    const u = await prisma.user.findUniqueOrThrow({ where: { lineId: "Utrial-race" } })
    expect(await startProTrial(u.id)).toBeNull()
    expect(await startProTrial(u.id, new Date(Date.now() + 60 * DAY))).toBeNull() // trial long over
    // Even if Pro were switched off by hand, the trial date still blocks a second one
    await prisma.user.update({ where: { id: u.id }, data: { subscriptionTier: "FREE", proExpiresAt: null } })
    expect(await startProTrial(u.id)).toBeNull()
  })

  it("not for accounts that already paid, or are Pro now, or the shared demo", async () => {
    const paid = await prisma.user.create({ data: { lineId: "Utrial-paid" } })
    await prisma.subscriptionPayment.create({ data: { userId: paid.id, reference: "Utrial-ref-1", amount: 59 } })
    expect(await startProTrial(paid.id)).toBeNull()

    const pro = await prisma.user.create({ data: { lineId: "Utrial-pro", subscriptionTier: "PRO", proExpiresAt: new Date(Date.now() + 5 * DAY) } })
    expect(await startProTrial(pro.id)).toBeNull()

    const demo = await prisma.user.create({ data: { lineId: "demo" } })
    expect(await startProTrial(demo.id)).toBeNull()
    await prisma.user.delete({ where: { id: demo.id } })

    const fresh = await prisma.user.create({ data: { lineId: "Utrial-fresh" } })
    expect(await startProTrial(fresh.id)).not.toBeNull()
  })
})
