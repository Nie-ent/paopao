"use server"

import { z } from "zod"
import prisma from "@/lib/db"
import { getCurrentUser } from "@/lib/current-user"
import { isProActive, LIMITS } from "@/lib/subscription"

const billSchema = z.object({
  name: z.string().trim().min(1).max(40),
  category: z.string().trim().min(1).max(40),
  amount: z.number().positive().max(100_000_000).nullable(),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
  dayOfWeek: z.number().int().min(0).max(6).nullable(),
  dayOfMonth: z.number().int().min(1).max(31).nullable(),
  active: z.boolean().default(true),
}).refine(b => b.frequency !== "WEEKLY" || b.dayOfWeek !== null, { path: ["dayOfWeek"] })
  .refine(b => b.frequency !== "MONTHLY" || b.dayOfMonth !== null, { path: ["dayOfMonth"] })

export type BillInput = z.input<typeof billSchema>

/** Keeps only the day field that matches the frequency. */
function normalize(b: z.output<typeof billSchema>) {
  return { ...b, dayOfWeek: b.frequency === "WEEKLY" ? b.dayOfWeek : null, dayOfMonth: b.frequency === "MONTHLY" ? b.dayOfMonth : null }
}

export async function getBills() {
  const user = await getCurrentUser()
  if (!user) return { error: "Unauthorized" as const, bills: [], isPro: false, limit: LIMITS.proRecurringBills }
  const bills = await prisma.recurringBill.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } })
  return { bills, isPro: isProActive(user), limit: LIMITS.proRecurringBills }
}

export async function saveBill(id: string | null, input: BillInput) {
  const user = await getCurrentUser()
  if (!user) return { error: "Unauthorized" }
  if (!isProActive(user)) return { error: "PRO_ONLY" }
  const parsed = billSchema.safeParse(input)
  if (!parsed.success) return { error: "INVALID" }
  const data = normalize(parsed.data)

  if (id) {
    const { count } = await prisma.recurringBill.updateMany({ where: { id, userId: user.id }, data: { ...data, lastAskedOn: null } })
    return count ? { success: true } : { error: "NOT_FOUND" }
  }
  // Locked count so parallel requests can't exceed the limit
  const created = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`
    if (await tx.recurringBill.count({ where: { userId: user.id } }) >= LIMITS.proRecurringBills) return false
    await tx.recurringBill.create({ data: { ...data, userId: user.id } })
    return true
  })
  return created ? { success: true } : { error: "LIMIT" }
}

export async function deleteBill(id: string) {
  const user = await getCurrentUser()
  if (!user) return { error: "Unauthorized" }
  const { count } = await prisma.recurringBill.deleteMany({ where: { id, userId: user.id } })
  return count ? { success: true } : { error: "NOT_FOUND" }
}
