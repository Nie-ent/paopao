/**
 * Server side of the bill-splitting page (/split/[billId], opened from a group's bill card in LINE).
 * The viewer proves who they are with their LIFF access token, and must be a member of the group
 * the bill belongs to. They need no PaoPao account.
 */
import { z } from "zod"
import prisma from "@/lib/db"
import { verifyLiffAccessToken } from "@/lib/line-login"
import { debtsFor, GROUP_LIMITS, splitBill } from "@/lib/group-split"
import { isValidAmount } from "@/lib/money"
import { fetchMemberProfile } from "@/services/group.service"

export class SplitError extends Error {
  constructor(public code: "UNAUTHORIZED" | "NOT_FOUND" | "NOT_MEMBER" | "FORBIDDEN" | "INVALID" | "CLOSED" | "HAS_PAYMENTS" | "NO_PARTICIPANTS", public status: number) {
    super(code)
  }
}

/** The viewer's LINE user id, after checking the bill exists and they are in its group. */
export async function authorize(accessToken: string | null, billId: string) {
  const profile = accessToken ? await verifyLiffAccessToken(accessToken) : null
  if (!profile) throw new SplitError("UNAUTHORIZED", 401)
  const bill = await prisma.groupBill.findUnique({ where: { id: billId }, include: { group: true } })
  if (!bill) throw new SplitError("NOT_FOUND", 404)

  const known = await prisma.groupMember.findUnique({ where: { groupId_lineUserId: { groupId: bill.groupId, lineUserId: profile.userId } } })
  if (!known) {
    // Not seen in this group yet: LINE answers the member-profile call only for current members
    const member = await fetchMemberProfile(bill.group, profile.userId)
    if (!member) throw new SplitError("NOT_MEMBER", 403)
  }
  // The page polls, so only write when the name or picture changed
  if (known && known.displayName === profile.displayName && known.pictureUrl === (profile.pictureUrl ?? null)) return { me: profile.userId, bill }
  await prisma.groupMember.upsert({
    where: { groupId_lineUserId: { groupId: bill.groupId, lineUserId: profile.userId } },
    create: { groupId: bill.groupId, lineUserId: profile.userId, displayName: profile.displayName, pictureUrl: profile.pictureUrl ?? null },
    update: { displayName: profile.displayName, pictureUrl: profile.pictureUrl ?? null },
  })
  return { me: profile.userId, bill }
}

/** Everything the page shows. */
export async function billView(billId: string, me: string) {
  const bill = await prisma.groupBill.findUniqueOrThrow({
    where: { id: billId },
    include: { items: { orderBy: { position: "asc" }, include: { claims: true } }, debts: { orderBy: { createdAt: "asc" } } },
  })
  const members = await prisma.groupMember.findMany({ where: { groupId: bill.groupId }, orderBy: { displayName: "asc" } })
  const items = bill.items.map(i => ({
    id: i.id, name: i.name, amount: i.amount, discount: i.discount, quantity: i.quantity,
    claims: i.claims.map(c => ({ userId: c.lineUserId, units: c.units })),
  }))
  const split = splitBill(items, bill)
  // Shown to people who owe the payer, so they can scan and pay
  const iOwe = bill.debts.some(d => d.debtorId === me && d.status !== "PAID" && d.status !== "CANCELLED")
  const payee = bill.paidBy === me || iOwe ? await prisma.linePayee.findUnique({ where: { lineUserId: bill.paidBy } }) : null

  return {
    me,
    canEdit: me === bill.createdBy || me === bill.paidBy,
    bill: {
      id: bill.id, title: bill.title, status: bill.status, paidBy: bill.paidBy, createdBy: bill.createdBy,
      serviceCharge: bill.serviceCharge, vat: bill.vat, discount: bill.discount, printedTotal: bill.printedTotal, items,
    },
    members: members.map(m => ({ lineUserId: m.lineUserId, displayName: m.displayName, pictureUrl: m.pictureUrl })),
    split: {
      shares: Object.fromEntries(split.shares), unclaimed: split.unclaimed, leftover: split.leftover,
      subtotal: split.subtotal, itemsNet: split.itemsNet, total: split.total, adjustment: split.adjustment,
    },
    debts: bill.debts.map(d => ({ id: d.id, debtorId: d.debtorId, creditorId: d.creditorId, amount: d.amount, status: d.status })),
    payeePromptPay: payee?.promptPayId ?? null,
  }
}

export type BillView = Awaited<ReturnType<typeof billView>>

const amount = z.number().refine(n => n === 0 || isValidAmount(n))
const ActionSchema = z.discriminatedUnion("action", [
  /** How many units of the item the viewer had; 0 removes their claim */
  z.object({ action: z.literal("claim"), itemId: z.string().uuid(), units: z.number().int().min(0).max(999) }),
  z.object({ action: z.literal("setPaidBy"), lineUserId: z.string().min(1).max(64) }),
  z.object({
    action: z.literal("edit"),
    title: z.string().trim().min(1).max(60),
    serviceCharge: amount, vat: amount, discount: amount,
    /** Grand total on the receipt; 0 = not known (shares then add up to items + extras) */
    printedTotal: amount,
    items: z.array(z.object({
      id: z.string().uuid().optional(), name: z.string().trim().min(1).max(80), amount: z.number().refine(isValidAmount),
      discount: amount, quantity: z.number().int().min(1).max(999),
    })).min(1).max(GROUP_LIMITS.maxItems),
  }),
  z.object({ action: z.literal("close") }),
  z.object({ action: z.literal("reopen") }),
  z.object({ action: z.literal("cancel") }),
  /** Thai mobile (10 digits), national/tax ID (13) or e-wallet (15) */
  z.object({ action: z.literal("setPromptPay"), promptPayId: z.string().transform(s => s.replace(/[\s-]/g, "")).refine(s => /^(0\d{9}|\d{13}|\d{15})$/.test(s)) }),
])

export async function applyAction(billId: string, me: string, body: unknown) {
  const parsed = ActionSchema.safeParse(body)
  if (!parsed.success) throw new SplitError("INVALID", 400)
  const input = parsed.data
  const bill = await prisma.groupBill.findUniqueOrThrow({ where: { id: billId }, include: { debts: true } })
  const canEdit = me === bill.createdBy || me === bill.paidBy
  const requireEdit = () => { if (!canEdit) throw new SplitError("FORBIDDEN", 403) }
  const requireOpen = () => { if (bill.status !== "OPEN") throw new SplitError("CLOSED", 409) }

  switch (input.action) {
    case "claim": {
      requireOpen()
      const item = await prisma.groupBillItem.findFirst({ where: { id: input.itemId, billId } })
      if (!item) throw new SplitError("NOT_FOUND", 404)
      const units = Math.min(input.units, item.quantity)
      if (units > 0) {
        await prisma.groupBillClaim.upsert({ where: { itemId_lineUserId: { itemId: item.id, lineUserId: me } }, create: { itemId: item.id, lineUserId: me, units }, update: { units } })
      } else {
        await prisma.groupBillClaim.deleteMany({ where: { itemId: item.id, lineUserId: me } })
      }
      break
    }
    case "setPaidBy": {
      requireEdit(); requireOpen()
      const member = await prisma.groupMember.findUnique({ where: { groupId_lineUserId: { groupId: bill.groupId, lineUserId: input.lineUserId } } })
      if (!member) throw new SplitError("INVALID", 400)
      await prisma.groupBill.update({ where: { id: billId }, data: { paidBy: input.lineUserId } })
      break
    }
    case "edit": {
      requireEdit(); requireOpen()
      const existing = await prisma.groupBillItem.findMany({ where: { billId }, select: { id: true } })
      const keep = new Set(input.items.flatMap(i => (i.id ? [i.id] : [])))
      if ([...keep].some(id => !existing.some(e => e.id === id))) throw new SplitError("INVALID", 400)
      await prisma.$transaction([
        prisma.groupBillItem.deleteMany({ where: { billId, id: { notIn: [...keep] } } }),
        ...input.items.map((i, position) => i.id
          ? prisma.groupBillItem.update({ where: { id: i.id }, data: { name: i.name, amount: i.amount, discount: i.discount, quantity: i.quantity, position } })
          : prisma.groupBillItem.create({ data: { billId, name: i.name, amount: i.amount, discount: i.discount, quantity: i.quantity, position } })),
        // A smaller quantity caps what people already claimed
        ...input.items.flatMap(i => (i.id ? [prisma.groupBillClaim.updateMany({ where: { itemId: i.id, units: { gt: i.quantity } }, data: { units: i.quantity } })] : [])),
        prisma.groupBill.update({
          where: { id: billId },
          data: { title: input.title, serviceCharge: input.serviceCharge, vat: input.vat, discount: input.discount, printedTotal: input.printedTotal || null },
        }),
      ])
      break
    }
    case "close": {
      requireEdit(); requireOpen()
      const items = await prisma.groupBillItem.findMany({ where: { billId }, include: { claims: true } })
      const { shares } = splitBill(items.map(i => ({
        id: i.id, amount: i.amount, discount: i.discount, quantity: i.quantity, claims: i.claims.map(c => ({ userId: c.lineUserId, units: c.units })),
      })), bill)
      if (shares.size === 0) throw new SplitError("NO_PARTICIPANTS", 409)
      const debts = debtsFor(shares, bill.paidBy)
      await prisma.$transaction(async tx => {
        const { count } = await tx.groupBill.updateMany({ where: { id: billId, status: "OPEN" }, data: { status: "CLOSED", closedAt: new Date() } })
        if (count === 0) throw new SplitError("CLOSED", 409)
        await tx.groupDebt.createMany({ data: debts.map(d => ({ groupId: bill.groupId, billId, debtorId: d.debtorId, creditorId: bill.paidBy, amount: d.amount })) })
      })
      break
    }
    case "reopen": {
      requireEdit()
      if (bill.status !== "CLOSED") throw new SplitError("INVALID", 400)
      // Once someone has paid, changing the bill would leave their payment pointing at old numbers
      if (bill.debts.some(d => d.status === "PAID" || d.status === "CLAIMED")) throw new SplitError("HAS_PAYMENTS", 409)
      await prisma.$transaction([
        prisma.groupDebt.deleteMany({ where: { billId } }),
        prisma.groupBill.update({ where: { id: billId }, data: { status: "OPEN", closedAt: null } }),
      ])
      break
    }
    case "cancel": {
      requireEdit()
      if (bill.debts.some(d => d.status === "PAID" || d.status === "CLAIMED")) throw new SplitError("HAS_PAYMENTS", 409)
      await prisma.$transaction([
        prisma.groupDebt.deleteMany({ where: { billId } }),
        prisma.groupBill.update({ where: { id: billId }, data: { status: "CANCELLED" } }),
      ])
      break
    }
    case "setPromptPay": {
      await prisma.linePayee.upsert({ where: { lineUserId: me }, create: { lineUserId: me, promptPayId: input.promptPayId }, update: { promptPayId: input.promptPayId } })
      break
    }
  }
  return billView(billId, me)
}
