/**
 * PaoPao in LINE groups: split a bill from a receipt photo, then track and chase who owes whom.
 * Rules and math: src/lib/group-split.ts. Cards: src/lib/group-cards.ts. Tick page: /split/[billId].
 *
 * The bot stays quiet in group chats. It only acts on its own commands ("แยกบิล", "ยอดค้าง",
 * "เป๋าเป๋า"), on the image right after "แยกบิล", on images from people who owe money in the group
 * (a repayment slip), and on its own buttons. Everything here is a reply, which costs no LINE
 * message quota; a push to a group is counted once per member.
 */
import type { messagingApi } from "@line/bot-sdk"
import { lineBlobClient, lineClient } from "@/config/line"
import prisma from "@/lib/db"
import { withAiUser } from "@/lib/ai-usage"
import { bangkokDate, bangkokParts, startOfBangkokDay } from "@/lib/dates"
import { hashImage } from "@/lib/slip"
import { verifySlipImage } from "@/lib/slip-verify"
import { isProActive } from "@/lib/subscription"
import { liffUrl } from "@/lib/site"
import {
  ARM_MS, GROUP_LIMITS, debtsSettledBy, isDebtsCommand, isGroupHelpCommand, parseGroupAction, parseSplitCommand, type GroupAction,
} from "@/lib/group-split"
import {
  armedMessage, billCard, claimCard, debtsCard, groupWelcomeCard, receiptLimitMessage, remindMessage, slipPaidCard, type DebtRow,
} from "@/lib/group-cards"
import { readReceipt, receiptAddsUp } from "@/services/receipt.service"
import { reply, replyText } from "@/services/line.service"

type Source = { type: string; groupId?: string; roomId?: string; userId?: string }
type Group = { id: string; lineGroupId: string; kind: string; armedBy: string | null; armedUntil: Date | null }

export const isGroupSource = (source: Source | undefined) => source?.type === "group" || source?.type === "room"

const baht = (n: number) => `฿${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
const DAY_MS = 24 * 60 * 60 * 1000
/** Display names are refreshed from LINE at most this often */
const NAME_TTL_MS = 7 * DAY_MS

export async function ensureGroup(source: Source) {
  const lineGroupId = source.groupId ?? source.roomId!
  const kind = source.type === "room" ? "ROOM" : "GROUP"
  return prisma.lineGroup.upsert({
    where: { lineGroupId },
    create: { lineGroupId, kind },
    update: { leftAt: null },
  })
}

/** A member's name in the group, cached; LINE only answers for current members. */
export async function memberName(group: Pick<Group, "id" | "lineGroupId" | "kind">, lineUserId: string): Promise<string> {
  const cached = await prisma.groupMember.findUnique({ where: { groupId_lineUserId: { groupId: group.id, lineUserId } } })
  if (cached && Date.now() - cached.updatedAt.getTime() < NAME_TTL_MS) return cached.displayName
  const profile = await fetchMemberProfile(group, lineUserId)
  if (!profile) return cached?.displayName ?? "สมาชิก"
  await prisma.groupMember.upsert({
    where: { groupId_lineUserId: { groupId: group.id, lineUserId } },
    create: { groupId: group.id, lineUserId, displayName: profile.displayName, pictureUrl: profile.pictureUrl ?? null },
    update: { displayName: profile.displayName, pictureUrl: profile.pictureUrl ?? null },
  })
  return profile.displayName
}

/** LINE profile of a group member, or null when they aren't in the group (or LINE is unavailable). */
export async function fetchMemberProfile(group: Pick<Group, "lineGroupId" | "kind">, lineUserId: string) {
  try {
    return group.kind === "ROOM"
      ? await lineClient.getRoomMemberProfile(group.lineGroupId, lineUserId)
      : await lineClient.getGroupMemberProfile(group.lineGroupId, lineUserId)
  } catch {
    return null
  }
}

async function downloadImage(messageId: string) {
  const stream = await lineBlobClient.getMessageContent(messageId)
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

/** The PaoPao account (if any) behind a LINE user, for Pro limits and AI cost attribution. */
async function paoPaoUser(lineUserId: string) {
  return prisma.user.findUnique({ where: { lineId: lineUserId }, select: { id: true, subscriptionTier: true, proExpiresAt: true } })
}

export const billUrl = (billId: string) => liffUrl(`/split/${billId}`)

// ── Events ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleGroupEvent(event: any) {
  const source = event.source as Source
  if (event.type === "leave") {
    await prisma.lineGroup.updateMany({ where: { lineGroupId: source.groupId ?? source.roomId }, data: { leftAt: new Date() } })
    return null
  }
  const group = await ensureGroup(source)

  if (event.type === "join") {
    if (group.kind === "GROUP") {
      const summary = await lineClient.getGroupSummary(group.lineGroupId).catch(() => null)
      if (summary?.groupName) await prisma.lineGroup.update({ where: { id: group.id }, data: { name: summary.groupName } })
    }
    return reply(event.replyToken, [groupWelcomeCard()], "เป๋าเป๋าช่วยแยกบิล: พิมพ์ \"แยกบิล\" แล้วส่งรูปใบเสร็จ")
  }

  const userId = source.userId
  if (!userId || !event.replyToken) return null

  if (event.type === "postback" && typeof event.postback?.data === "string") {
    const action = parseGroupAction(event.postback.data)
    return action ? handleAction(group, userId, event.replyToken, action) : null
  }
  if (event.type !== "message") return null

  if (event.message.type === "text") {
    const text = String(event.message.text ?? "")
    const split = parseSplitCommand(text)
    if (split?.kind === "amount") return createAmountBill(group, userId, event.replyToken, split.amount, split.title)
    if (split?.kind === "receipt") {
      // "แยกบิล" sent as a reply to a photo reads that photo
      if (event.message.quotedMessageId) return processReceipt(group, userId, event.message.quotedMessageId, event.replyToken)
      await prisma.lineGroup.update({ where: { id: group.id }, data: { armedBy: userId, armedUntil: new Date(Date.now() + ARM_MS) } })
      return reply(event.replyToken, [armedMessage()], armedMessage().text)
    }
    if (isDebtsCommand(text)) return replyDebts(group, event.replyToken)
    if (isGroupHelpCommand(text)) return reply(event.replyToken, [groupWelcomeCard()], "พิมพ์ \"แยกบิล\" แล้วส่งรูปใบเสร็จ")
    return null
  }

  if (event.message.type === "image") {
    if (group.armedBy === userId && group.armedUntil && group.armedUntil > new Date()) {
      await prisma.lineGroup.update({ where: { id: group.id }, data: { armedBy: null, armedUntil: null } })
      return processReceipt(group, userId, event.message.id, event.replyToken)
    }
    const owes = await prisma.groupDebt.count({ where: { groupId: group.id, debtorId: userId, status: { in: ["OPEN", "CLAIMED"] } } })
    if (owes > 0) return processRepaymentSlip(group, userId, event.message.id, event.replyToken)
  }
  return null
}

// ── Bills ───────────────────────────────────────────────────────────────────

async function processReceipt(group: Group, userId: string, messageId: string, replyToken: string) {
  const user = await paoPaoUser(userId)
  if (!(user && isProActive(user))) {
    const { year, month } = bangkokParts(new Date())
    const used = await prisma.groupUsageEvent.count({ where: { groupId: group.id, kind: "receipt", createdAt: { gte: bangkokDate(year, month, 1) } } })
    if (used >= GROUP_LIMITS.freeReceiptsPerMonth) return reply(replyToken, [receiptLimitMessage()], receiptLimitMessage().text)
  }

  let image: Buffer
  try {
    image = await downloadImage(messageId)
  } catch {
    return replyText(replyToken, "เปิดรูปนี้ไม่ได้แล้ว ลองส่งรูปใบเสร็จใหม่อีกครั้งนะ")
  }
  const receiptHash = hashImage(image)
  const existing = await prisma.groupBill.findFirst({
    where: { groupId: group.id, receiptHash, status: { not: "CANCELLED" }, createdAt: { gte: new Date(Date.now() - 30 * DAY_MS) } },
    include: { items: true },
  })
  if (existing) {
    const total = existing.items.reduce((s, i) => s + i.amount, 0) + existing.serviceCharge + existing.vat - existing.discount
    return reply(replyToken, [
      { type: "text", text: "ใบเสร็จนี้แยกบิลไปแล้ว กดที่การ์ดเพื่อเลือกรายการต่อได้เลย" },
      billCard({ title: existing.title, total, itemCount: existing.items.length, payerName: await memberName(group, existing.paidBy), url: billUrl(existing.id) }),
    ], "ใบเสร็จนี้แยกบิลไปแล้ว")
  }

  await prisma.groupUsageEvent.create({ data: { groupId: group.id, kind: "receipt", lineUserId: userId } })
  const receipt = await withAiUser(user?.id ?? null, () => readReceipt(image)).catch(error => {
    console.error("[group] receipt read failed", error)
    return null
  })
  if (!receipt) return replyText(replyToken, "อ่านใบเสร็จนี้ไม่ได้ 🙏 ลองถ่ายให้เห็นรายการชัดๆ อีกครั้ง หรือพิมพ์ \"แยกบิล 1200 ค่าอาหาร\" เพื่อหารเท่ากัน")

  const items = receipt.items.slice(0, GROUP_LIMITS.maxItems)
  const title = receipt.merchant || `บิล ${new Date().toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" })}`
  const bill = await prisma.groupBill.create({
    data: {
      groupId: group.id, createdBy: userId, paidBy: userId, title, receiptHash,
      serviceCharge: receipt.serviceCharge, vat: receipt.vat, discount: receipt.discount,
      items: { create: items.map((item, position) => ({ ...item, position })) },
    },
  })
  const total = items.reduce((s, i) => s + i.amount, 0) + receipt.serviceCharge + receipt.vat - receipt.discount
  const warning = !receiptAddsUp({ ...receipt, items })
    ? `ยอดที่อ่านได้ไม่ตรงกับยอดรวมในใบเสร็จ (${baht(receipt.printedTotal)}) คนจ่ายบิลแก้ได้ในหน้าเลือกรายการ`
    : receipt.items.length > items.length ? `แสดง ${items.length} รายการแรก` : undefined
  return reply(replyToken, [billCard({ title, total, itemCount: items.length, payerName: await memberName(group, userId), url: billUrl(bill.id), warning })],
    `แยกบิล ${title} ${baht(total)}: ${billUrl(bill.id)}`)
}

async function createAmountBill(group: Group, userId: string, replyToken: string, amount: number, title: string) {
  const bill = await prisma.groupBill.create({
    data: { groupId: group.id, createdBy: userId, paidBy: userId, title, items: { create: [{ name: title, amount, quantity: 1, position: 0 }] } },
  })
  return reply(replyToken, [billCard({ title, total: amount, itemCount: 1, payerName: await memberName(group, userId), url: billUrl(bill.id) })],
    `แยกบิล ${title} ${baht(amount)}: ${billUrl(bill.id)}`)
}

// ── Debts ───────────────────────────────────────────────────────────────────

async function openDebts(groupId: string) {
  return prisma.groupDebt.findMany({
    where: { groupId, status: { in: ["OPEN", "CLAIMED"] } },
    include: { bill: { select: { title: true } } },
    orderBy: { createdAt: "asc" },
  })
}

export async function debtRows(group: Group, debts: Awaited<ReturnType<typeof openDebts>>): Promise<DebtRow[]> {
  const names = new Map<string, string>()
  for (const id of new Set(debts.flatMap(d => [d.debtorId, d.creditorId]))) names.set(id, await memberName(group, id))
  return debts.map(d => ({
    debtId: d.id, debtorName: names.get(d.debtorId)!, creditorName: names.get(d.creditorId)!, amount: d.amount, billTitle: d.bill.title, claimed: d.status === "CLAIMED",
  }))
}

async function replyDebts(group: Group, replyToken: string) {
  const debts = await openDebts(group.id)
  const latestBill = debts.at(-1)?.billId
  const card = debtsCard(await debtRows(group, debts), { url: latestBill ? billUrl(latestBill) : undefined })
  return reply(replyToken, [card], card.type === "text" ? card.text : "ดูยอดค้างในกลุ่ม")
}

async function processRepaymentSlip(group: Group, userId: string, messageId: string, replyToken: string) {
  const checks = await prisma.groupUsageEvent.count({ where: { groupId: group.id, kind: "slip_check", createdAt: { gte: startOfBangkokDay() } } })
  if (checks >= GROUP_LIMITS.slipChecksPerDay) return null

  let image: Buffer
  try {
    image = await downloadImage(messageId)
  } catch {
    return null
  }
  await prisma.groupUsageEvent.create({ data: { groupId: group.id, kind: "slip_check", lineUserId: userId } })
  const slip = await verifySlipImage(image)
  // An ordinary photo, or the check is down: stay quiet rather than answer every picture
  if (!slip.ok) {
    if (slip.reason === "PENDING") return replyText(replyToken, "สลิปนี้ยังไม่เข้าระบบธนาคาร ลองส่งใหม่อีกครั้งในสักครู่นะ")
    return null
  }
  if (await prisma.groupDebt.count({ where: { slipRef: slip.transRef } }) > 0) return replyText(replyToken, "สลิปนี้ใช้ปิดยอดไปแล้ว")

  const debts = (await openDebts(group.id)).filter(d => d.debtorId === userId)
  let settled = debtsSettledBy(debts, slip.amount)
  if (settled.length === 0) {
    for (const creditorId of new Set(debts.map(d => d.creditorId))) {
      settled = debtsSettledBy(debts.filter(d => d.creditorId === creditorId), slip.amount)
      if (settled.length) break
    }
  }
  if (settled.length === 0) {
    const owed = debts.reduce((s, d) => s + d.amount, 0)
    return replyText(replyToken, `ได้รับสลิป ${baht(slip.amount)} แต่ไม่ตรงกับยอดค้าง (${baht(owed)}) 🤔\nถ้าจ่ายแล้วจริง พิมพ์ "ยอดค้าง" แล้วกด "จ่ายแล้ว" ให้เจ้าของเงินยืนยัน`)
  }

  const { count } = await prisma.groupDebt.updateMany({
    where: { id: { in: settled.map(d => d.id) }, status: { in: ["OPEN", "CLAIMED"] } },
    data: { status: "PAID", slipRef: slip.transRef, paidAt: new Date() },
  })
  if (count === 0) return null
  return reply(replyToken, [slipPaidCard({
    debtorName: await memberName(group, userId),
    creditorName: await memberName(group, settled[0].creditorId),
    amount: slip.amount,
    billTitles: settled.map(d => d.bill.title),
    firstDebtId: settled[0].id,
  })], `✅ จ่ายแล้ว ${baht(slip.amount)}`)
}

async function handleAction(group: Group, userId: string, replyToken: string, action: GroupAction) {
  if (action.kind === "remind") {
    const debts = await openDebts(group.id)
    // One reminder per few minutes: several people tapping at once shouldn't flood the chat
    if (debts.some(d => d.lastRemindedAt && Date.now() - d.lastRemindedAt.getTime() < 5 * 60 * 1000)) {
      return replyText(replyToken, "เพิ่งทวงไปเมื่อสักครู่ รอสักพักนะ 🙏")
    }
    const rows = await debtRows(group, debts)
    await prisma.groupDebt.updateMany({ where: { id: { in: debts.map(d => d.id) } }, data: { lastRemindedAt: new Date() } })
    const message = remindMessage(debts.map((d, i) => ({ debtorId: d.debtorId, creditorName: rows[i].creditorName, amount: d.amount })))
    return reply(replyToken, [message as messagingApi.Message], "ทวงยอดค้างในกลุ่ม")
  }

  const debt = await prisma.groupDebt.findFirst({ where: { id: action.debtId, groupId: group.id }, include: { bill: { select: { title: true } } } })
  if (!debt) return null
  const debtorName = await memberName(group, debt.debtorId)
  const creditorName = await memberName(group, debt.creditorId)

  if (action.kind === "paid") {
    if (userId !== debt.debtorId) return replyText(replyToken, `ปุ่มนี้สำหรับ ${debtorName} 🙏`)
    if (debt.status !== "OPEN") return null
    await prisma.groupDebt.update({ where: { id: debt.id }, data: { status: "CLAIMED" } })
    return reply(replyToken, [claimCard({ debtId: debt.id, debtorName, creditorName, amount: debt.amount })], `${debtorName} บอกว่าจ่ายแล้ว รอ ${creditorName} ยืนยัน`)
  }

  if (userId !== debt.creditorId) return replyText(replyToken, `ปุ่มนี้สำหรับ ${creditorName} 🙏`)
  if (action.kind === "confirm") {
    if (debt.status === "PAID" || debt.status === "CANCELLED") return null
    await prisma.groupDebt.update({ where: { id: debt.id }, data: { status: "PAID", paidAt: new Date() } })
    return replyText(replyToken, `✅ ${creditorName} ได้รับ ${baht(debt.amount)} จาก ${debtorName} แล้ว (${debt.bill.title})`)
  }
  // reject: back to owing; a slip that paid several debts reopens all of them
  if (debt.status !== "CLAIMED" && debt.status !== "PAID") return null
  const where = debt.slipRef ? { slipRef: debt.slipRef, groupId: group.id } : { id: debt.id }
  await prisma.groupDebt.updateMany({ where, data: { status: "OPEN", slipRef: null, paidAt: null } })
  return replyText(replyToken, `${creditorName} ยังไม่ได้รับเงิน ${baht(debt.amount)} จาก ${debtorName} ยอดนี้กลับเป็นค้างจ่าย`)
}

// ── Weekly reminder (the only push) ─────────────────────────────────────────

/**
 * Mondays: one reminder per group that has money owed to a Pro user. A push to a group counts once
 * per member against the LINE quota, so it goes out at most weekly and only for Pro creditors.
 */
export async function sendWeeklyGroupReminders(now = new Date(), maxGroups = 50) {
  const debts = await prisma.groupDebt.findMany({
    where: { status: { in: ["OPEN", "CLAIMED"] }, group: { leftAt: null } },
    include: { bill: { select: { title: true } }, group: true },
    orderBy: { createdAt: "asc" },
  })
  const proCreditors = new Set((await prisma.user.findMany({
    where: { lineId: { in: [...new Set(debts.map(d => d.creditorId))] }, proExpiresAt: { gt: now }, subscriptionTier: { not: "FREE" } },
    select: { lineId: true },
  })).map(u => u.lineId))

  const byGroup = new Map<string, typeof debts>()
  for (const d of debts) byGroup.set(d.groupId, [...(byGroup.get(d.groupId) ?? []), d])

  let sent = 0
  for (const groupDebts of byGroup.values()) {
    if (sent >= maxGroups) break
    if (!groupDebts.some(d => proCreditors.has(d.creditorId))) continue
    // Someone tapped "ทวง" this week already
    if (groupDebts.some(d => d.lastRemindedAt && now.getTime() - d.lastRemindedAt.getTime() < 6 * DAY_MS)) continue
    const group = groupDebts[0].group
    const rows = await debtRows(group, groupDebts)
    const card = debtsCard(rows, { url: billUrl(groupDebts.at(-1)!.billId), title: "สรุปยอดค้างประจำสัปดาห์" })
    const mention = remindMessage(groupDebts.map((d, i) => ({ debtorId: d.debtorId, creditorName: rows[i].creditorName, amount: d.amount })))
    try {
      await lineClient.pushMessage({ to: group.lineGroupId, messages: [mention as messagingApi.Message, card] })
      await prisma.groupDebt.updateMany({ where: { id: { in: groupDebts.map(d => d.id) } }, data: { lastRemindedAt: now } })
      sent++
    } catch (error) {
      console.error("[group] weekly reminder failed", (error as { status?: number })?.status ?? error)
    }
  }
  return { groups: sent }
}
