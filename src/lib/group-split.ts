/**
 * Splitting a bill in a LINE group, and the text commands and buttons that drive it. Pure: the
 * LINE and database side is src/services/group.service.ts.
 *
 * How a bill is shared:
 * - Each item is shared equally by the people who ticked it.
 * - An item nobody ticked is shared by everyone who ticked anything (nothing is left unpaid).
 * - Service charge and VAT are added, and a discount taken off, in proportion to each person's items.
 * - Everything is worked out in satang, and leftover satang go to the largest remainders, so the
 *   shares always add up to the bill total exactly.
 */

export type SplitItem = { id: string; amount: number; claimants: string[] }
export type SplitExtras = { serviceCharge: number; vat: number; discount: number }

const toSatang = (baht: number) => Math.round(baht * 100)

/** Splits `total` satang by `weights` (largest remainder; ties go to the earlier key). */
function apportion(total: number, weights: [string, number][]): Map<string, number> {
  const out = new Map<string, number>()
  const sum = weights.reduce((s, [, w]) => s + w, 0)
  if (sum <= 0 || weights.length === 0) return out
  const raw = weights.map(([k, w]) => ({ k, exact: (total * w) / sum }))
  let given = 0
  for (const r of raw) {
    const floor = Math.floor(r.exact)
    out.set(r.k, floor)
    given += floor
  }
  const order = [...raw].sort((a, b) => (b.exact - Math.floor(b.exact)) - (a.exact - Math.floor(a.exact)))
  for (let i = 0; i < total - given; i++) out.set(order[i % order.length].k, out.get(order[i % order.length].k)! + 1)
  return out
}

export function billTotals(items: { amount: number }[], extras: SplitExtras) {
  const subtotal = items.reduce((s, i) => s + toSatang(i.amount), 0)
  const total = subtotal + toSatang(extras.serviceCharge) + toSatang(extras.vat) - toSatang(extras.discount)
  return { subtotal: subtotal / 100, total: Math.max(0, total) / 100 }
}

/**
 * Each person's share in baht. `unclaimed` lists items nobody ticked (shared by all participants);
 * with no participants at all, nobody owes anything yet.
 */
export function splitBill(items: SplitItem[], extras: SplitExtras) {
  const participants = [...new Set(items.flatMap(i => i.claimants))].sort()
  const unclaimed = items.filter(i => i.claimants.length === 0).map(i => i.id)
  const itemShare = new Map<string, number>(participants.map(p => [p, 0]))

  for (const item of items) {
    const who = item.claimants.length ? [...new Set(item.claimants)].sort() : participants
    for (const [p, s] of apportion(toSatang(item.amount), who.map(p => [p, 1]))) itemShare.set(p, itemShare.get(p)! + s)
  }

  const extra = toSatang(extras.serviceCharge) + toSatang(extras.vat) - toSatang(extras.discount)
  const weights = participants.map(p => [p, itemShare.get(p)!] as [string, number])
  const extraShare = apportion(Math.abs(extra), weights)
  const shares = new Map<string, number>()
  for (const p of participants) {
    const satang = itemShare.get(p)! + Math.sign(extra) * (extraShare.get(p) ?? 0)
    shares.set(p, Math.max(0, satang) / 100)
  }
  return { shares, participants, unclaimed, ...billTotals(items, extras) }
}

/** Who owes the payer what: everyone with a share except the payer. */
export function debtsFor(shares: Map<string, number>, paidBy: string) {
  return [...shares].filter(([who, amount]) => who !== paidBy && amount > 0).map(([debtorId, amount]) => ({ debtorId, amount }))
}

/**
 * Which open debts a repayment slip of `amount` settles: one debt of exactly that amount (oldest
 * first), else all of them when it matches their total. Empty when it matches neither.
 */
export function debtsSettledBy<T extends { amount: number; createdAt: Date }>(openDebts: T[], amount: number): T[] {
  const cents = toSatang(amount)
  const sorted = [...openDebts].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  const exact = sorted.find(d => toSatang(d.amount) === cents)
  if (exact) return [exact]
  const total = sorted.reduce((s, d) => s + toSatang(d.amount), 0)
  return sorted.length > 1 && total === cents ? sorted : []
}

// ── Commands typed in the group ─────────────────────────────────────────────

const SPLIT = /^(แยกบิล|หารบิล|split)(?:\s+(.*))?$/i

/** "แยกบิล" alone arms receipt reading; "แยกบิล 1200 ค่าห้อง" makes an equal-split bill. */
export function parseSplitCommand(text: string): null | { kind: "receipt" } | { kind: "amount"; amount: number; title: string } {
  const m = text.trim().match(SPLIT)
  if (!m) return null
  const rest = (m[2] ?? "").trim()
  if (!rest) return { kind: "receipt" }
  const amount = rest.match(/^฿?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:บาท)?\s*(.*)$/)
  if (!amount) return { kind: "receipt" }
  const value = Number(amount[1].replace(/,/g, ""))
  if (!Number.isFinite(value) || value <= 0) return { kind: "receipt" }
  return { kind: "amount", amount: value, title: amount[2].trim() || "ค่าใช้จ่ายกลุ่ม" }
}

export const isDebtsCommand = (text: string) => /^(ยอดค้าง|ใครค้าง|ทวง|ทวงเงิน|สรุปบิล.*|debts?)$/i.test(text.trim())
export const isGroupHelpCommand = (text: string) => /^(เป๋าเป๋า|paopao|วิธีใช้|ช่วยด้วย|help)$/i.test(text.trim())

/** How long "แยกบิล" waits for the receipt photo */
export const ARM_MS = 3 * 60 * 1000

// ── Buttons (postback data) ─────────────────────────────────────────────────

export type GroupAction =
  | { kind: "paid"; debtId: string } // debtor: I paid (no slip)
  | { kind: "confirm"; debtId: string } // creditor: yes, I got it
  | { kind: "reject"; debtId: string } // creditor: not received / undo
  | { kind: "remind" } // anyone: remind everyone who owes in this group

export function encodeGroupAction(a: GroupAction) {
  return a.kind === "remind" ? "g:remind" : `g:${a.kind}:${a.debtId}`
}

export function parseGroupAction(data: string): GroupAction | null {
  if (data === "g:remind") return { kind: "remind" }
  const m = data.match(/^g:(paid|confirm|reject):([0-9a-f-]{36})$/)
  return m ? { kind: m[1] as "paid" | "confirm" | "reject", debtId: m[2] } : null
}

// ── Limits ──────────────────────────────────────────────────────────────────

export const GROUP_LIMITS = {
  /** Receipts read by AI per group per Bangkok month, unless the sender is Pro */
  freeReceiptsPerMonth: 10,
  /** Repayment slips checked with the bank per group per Bangkok day (each check costs) */
  slipChecksPerDay: 30,
  /** Items on one bill (LINE cards and the tick page stay usable) */
  maxItems: 40,
} as const
