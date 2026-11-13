/**
 * Splitting a bill in a LINE group, and the text commands and buttons that drive it. Pure: the
 * LINE and database side is src/services/group.service.ts.
 *
 * How a bill is shared:
 * - An item's own discount comes off that item only.
 * - Each person says how many units of an item they had (7 of 19 plates); the item is split by
 *   units. A one-unit item ticked by several people is shared equally.
 * - Units nobody took, and items nobody ticked, are shared equally by everyone who took part.
 * - What the items don't cover is shared in proportion to each person's items: service charge,
 *   VAT, a whole-bill discount, and, when the receipt's grand total is known, whatever else makes
 *   up that total (VAT charged on the service charge, rounding). So shares add up to what was
 *   actually paid, however the shop worked out its VAT.
 * - Everything is worked out in satang, and leftover satang go to the largest remainders, so the
 *   shares always add up to the total exactly.
 */

export type SplitClaim = { userId: string; units: number }
export type SplitItem = { id: string; amount: number; discount?: number; quantity?: number; claims: SplitClaim[] }
export type SplitExtras = { serviceCharge: number; vat: number; discount: number; printedTotal?: number | null }

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

const itemNet = (i: { amount: number; discount?: number }) => Math.max(0, toSatang(i.amount) - toSatang(i.discount ?? 0))

/**
 * The bill's totals in baht. `total` is what is shared: the printed grand total when known,
 * otherwise items + service + VAT − discount. `adjustment` is how far the printed total is from
 * that sum (e.g. VAT on the service charge), shown so nobody wonders where it came from.
 */
export function billTotals(items: { amount: number; discount?: number }[], extras: SplitExtras) {
  const subtotal = items.reduce((s, i) => s + toSatang(i.amount), 0)
  const itemsNet = items.reduce((s, i) => s + itemNet(i), 0)
  const computed = Math.max(0, itemsNet + toSatang(extras.serviceCharge) + toSatang(extras.vat) - toSatang(extras.discount))
  const printed = extras.printedTotal && extras.printedTotal > 0 ? toSatang(extras.printedTotal) : null
  const total = printed ?? computed
  return { subtotal: subtotal / 100, itemsNet: itemsNet / 100, computed: computed / 100, total: total / 100, adjustment: (total - computed) / 100 }
}

/**
 * Each person's share in baht. `unclaimed` lists items nobody ticked and `leftover` the units of
 * part-claimed items nobody took (both shared by all participants); with no participants at all,
 * nobody owes anything yet.
 */
export function splitBill(items: SplitItem[], extras: SplitExtras) {
  const claimsOf = (i: SplitItem) => i.claims.filter(c => c.units > 0)
  const participants = [...new Set(items.flatMap(i => claimsOf(i).map(c => c.userId)))].sort()
  const itemShare = new Map<string, number>(participants.map(p => [p, 0]))
  const add = (shares: Map<string, number>) => { for (const [p, s] of shares) itemShare.set(p, itemShare.get(p)! + s) }
  const unclaimed: string[] = []
  const leftover: { itemId: string; units: number }[] = []
  let pool = 0

  for (const item of items) {
    const net = itemNet(item)
    const quantity = Math.max(1, item.quantity ?? 1)
    const claims = claimsOf(item).map(c => [c.userId, Math.min(c.units, quantity)] as [string, number]).sort(([a], [b]) => a.localeCompare(b))
    const claimed = claims.reduce((s, [, u]) => s + u, 0)
    if (claims.length === 0) {
      unclaimed.push(item.id)
      pool += net
    } else if (quantity === 1 || claimed >= quantity) {
      add(apportion(net, claims))
    } else {
      const claimedPart = Math.round((net * claimed) / quantity)
      add(apportion(claimedPart, claims))
      pool += net - claimedPart
      leftover.push({ itemId: item.id, units: quantity - claimed })
    }
  }
  add(apportion(pool, participants.map(p => [p, 1])))

  const totals = billTotals(items, extras)
  const extra = toSatang(totals.total) - toSatang(totals.itemsNet)
  const extraShare = apportion(Math.abs(extra), participants.map(p => [p, itemShare.get(p)!]))
  const shares = new Map<string, number>()
  for (const p of participants) shares.set(p, Math.max(0, itemShare.get(p)! + Math.sign(extra) * (extraShare.get(p) ?? 0)) / 100)
  return { shares, participants, unclaimed, leftover, ...totals }
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
