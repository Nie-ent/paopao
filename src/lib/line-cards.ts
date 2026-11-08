/**
 * LINE Flex Message cards for the bot's replies, in the app's theme. Pure builders: each returns
 * a complete message (with altText, the text shown in notifications and the chat list).
 * Layout spec: https://developers.line.biz/en/reference/messaging-api/#flex-message
 */
import type { messagingApi } from "@line/bot-sdk"
import { th } from "@/i18n/messages"
import { buildMorningBrief, summarizeDay } from "@/lib/morning-brief"

type FlexMessage = messagingApi.FlexMessage
type FlexBox = messagingApi.FlexBox
type FlexComponent = messagingApi.FlexComponent
type Action = messagingApi.Action

export const COLORS = {
  primary: "#F28C6E",
  primarySoft: "#FFF1EC",
  text: "#334155",
  muted: "#64748B",
  border: "#E2E8F0",
  income: "#10B981",
  expense: "#E5604D",
  warnBg: "#FFF7E6",
  warnText: "#B45309",
  dangerBg: "#FDECEC",
  dangerText: "#DC2626",
  track: "#EEF2F6",
}

/** LINE limits that apply to what we build */
export const FLEX_LIMITS = { altText: 400, buttonLabel: 40, quickReplyLabel: 20, rows: 10 }

const baht = (n: number) => `฿${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + "…" : s)
const bkkDate = (d: Date) => d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: "Asia/Bangkok" })
export const categoryLabel = (name: string) => (th as Record<string, string>)[`category.${name}`] || name

// ---------- building blocks ----------

const text = (t: string, extra: Partial<messagingApi.FlexText> = {}): messagingApi.FlexText =>
  ({ type: "text", text: t || " ", color: COLORS.text, size: "sm", wrap: true, ...extra })

const box = (layout: FlexBox["layout"], contents: FlexComponent[], extra: Partial<FlexBox> = {}): FlexBox =>
  ({ type: "box", layout, contents, ...extra })

const dot = (color: string): FlexBox =>
  box("vertical", [], { width: "10px", height: "10px", cornerRadius: "5px", backgroundColor: color, offsetTop: "5px", flex: 0 })

const uriButton = (label: string, uri: string, primary = true): messagingApi.FlexButton => ({
  type: "button",
  style: primary ? "primary" : "link",
  color: primary ? COLORS.primary : COLORS.primary,
  height: "sm",
  action: { type: "uri", label: clip(label, FLEX_LIMITS.buttonLabel), uri },
})

const actionButton = (action: Action, primary = false): messagingApi.FlexButton => ({
  type: "button",
  style: primary ? "primary" : "secondary",
  color: primary ? COLORS.primary : undefined,
  height: "sm",
  action,
})

/** Soft coral header with a title and an optional right-aligned note */
function header(title: string, note?: string): FlexBox {
  return box("horizontal", [
    text(title, { weight: "bold", size: "md", color: COLORS.primary, flex: 1 }),
    ...(note ? [text(note, { size: "xs", color: COLORS.muted, align: "end", gravity: "center", flex: 0, wrap: false })] : []),
  ], { backgroundColor: COLORS.primarySoft, paddingAll: "16px" })
}

/** A tinted callout (warning, danger or info) */
function callout(message: string, tone: "warn" | "danger" | "info", extra: FlexComponent[] = []): FlexBox {
  const bg = tone === "danger" ? COLORS.dangerBg : tone === "warn" ? COLORS.warnBg : COLORS.primarySoft
  const fg = tone === "danger" ? COLORS.dangerText : tone === "warn" ? COLORS.warnText : COLORS.text
  return box("vertical", [text(message, { size: "xs", color: fg }), ...extra], { backgroundColor: bg, cornerRadius: "8px", paddingAll: "10px", spacing: "sm", margin: "md" })
}

/** A horizontal progress bar; `percent` is clamped to 0–100 */
function progressBar(percent: number, color: string): FlexBox {
  const p = Math.max(2, Math.min(100, Math.round(percent)))
  return box("vertical", [box("vertical", [], { width: `${p}%`, height: "6px", backgroundColor: color, cornerRadius: "3px" })],
    { height: "6px", backgroundColor: COLORS.track, cornerRadius: "3px", margin: "sm" })
}

function bubble(parts: { header?: FlexBox; body: FlexBox; footer?: FlexBox }): messagingApi.FlexBubble {
  return { type: "bubble", size: "mega", ...parts }
}

function flex(altText: string, contents: messagingApi.FlexContainer, quickReply?: messagingApi.QuickReply): FlexMessage {
  return { type: "flex", altText: clip(altText, FLEX_LIMITS.altText), contents, ...(quickReply ? { quickReply } : {}) }
}

// ---------- cards ----------

export type RecordedItem = { type: "INCOME" | "EXPENSE"; amount: number; category: string; categoryColor?: string | null; note?: string | null }
export type Duplicate = { date: Date; amount: number }

/** Monthly spending as a share of income, shown on the recorded card from 50% up. */
export function budgetTone(ratioPercent: number) {
  if (ratioPercent >= 90) return { tone: "danger" as const, color: COLORS.dangerText, message: `เดือนนี้ใช้ไปแล้ว ${Math.round(ratioPercent)}% ของรายรับ ลองชะลอการใช้จ่ายสักหน่อยนะครับ` }
  if (ratioPercent >= 80) return { tone: "warn" as const, color: COLORS.warnText, message: `เดือนนี้ใช้ไปแล้ว ${Math.round(ratioPercent)}% ของรายรับ ระวังการใช้จ่ายนะครับ` }
  if (ratioPercent >= 50) return { tone: "info" as const, color: COLORS.primary, message: `เดือนนี้ใช้ไปแล้ว ${Math.round(ratioPercent)}% ของรายรับ` }
  return null
}

/** Reply after recording one or more transactions (typed, slip photo or a bill answer). */
export function recordedCard(opts: { items: RecordedItem[]; dashboardUrl: string; now?: Date; budgetRatio?: number | null; duplicates?: Duplicate[] }): FlexMessage {
  const { items, dashboardUrl, now = new Date(), budgetRatio, duplicates = [] } = opts
  const shown = items.slice(0, FLEX_LIMITS.rows)
  const rows: FlexComponent[] = shown.map(item => {
    const sign = item.type === "INCOME" ? "+" : "−"
    return box("horizontal", [
      dot(item.categoryColor || (item.type === "INCOME" ? COLORS.income : COLORS.expense)),
      box("vertical", [
        text(categoryLabel(item.category), { weight: "bold" }),
        ...(item.note ? [text(item.note, { size: "xs", color: COLORS.muted })] : []),
      ], { flex: 1 }),
      text(`${sign}${baht(item.amount)}`, { weight: "bold", align: "end", flex: 0, wrap: false, color: item.type === "INCOME" ? COLORS.income : COLORS.expense }),
    ], { spacing: "md" })
  })
  if (items.length > shown.length) rows.push(text(`และอีก ${items.length - shown.length} รายการ`, { size: "xs", color: COLORS.muted }))

  const spent = items.filter(i => i.type === "EXPENSE").reduce((s, i) => s + i.amount, 0)
  const income = items.filter(i => i.type === "INCOME").reduce((s, i) => s + i.amount, 0)
  if (items.length > 1) {
    rows.push({ type: "separator", color: COLORS.border, margin: "md" })
    if (spent) rows.push(box("horizontal", [text("รวมรายจ่าย", { color: COLORS.muted }), text(`−${baht(spent)}`, { weight: "bold", align: "end", color: COLORS.expense })], { margin: "md" }))
    if (income) rows.push(box("horizontal", [text("รวมรายรับ", { color: COLORS.muted }), text(`+${baht(income)}`, { weight: "bold", align: "end", color: COLORS.income })], { margin: spent ? "sm" : "md" }))
  }

  const budget = budgetRatio != null ? budgetTone(budgetRatio) : null
  if (budget) rows.push(callout(budget.message, budget.tone, [progressBar(budgetRatio!, budget.color)]))
  if (duplicates.length) rows.push(callout(duplicateLines(duplicates), "warn"))

  const title = items.length === 1 ? "บันทึกแล้ว ✓" : `บันทึกแล้ว ${items.length} รายการ ✓`
  const alt = items.length === 1
    ? `บันทึกแล้ว: ${categoryLabel(items[0].category)} ${items[0].type === "INCOME" ? "+" : "−"}${baht(items[0].amount)}`
    : `บันทึกแล้ว ${items.length} รายการ${spent ? ` รวมจ่าย ${baht(spent)}` : ""}${income ? ` รวมรับ ${baht(income)}` : ""}`
  return flex(alt, bubble({
    header: header(title, bkkDate(now)),
    body: box("vertical", rows, { spacing: "md", paddingAll: "16px" }),
    footer: box("vertical", [uriButton("ดูแดชบอร์ด", dashboardUrl, false)], { paddingTop: "0px" }),
  }))
}

function duplicateLines(duplicates: Duplicate[]) {
  return `สลิปนี้เคยบันทึกแล้ว จึงไม่บันทึกซ้ำ\n${duplicates.map(d => `• ${baht(d.amount)} (บันทึกเมื่อ ${bkkDate(d.date)})`).join("\n")}`
}

/** Every slip sent was already recorded. */
export function duplicateCard(duplicates: Duplicate[]): FlexMessage {
  return flex(`สลิปนี้เคยบันทึกแล้ว ${duplicates.map(d => baht(d.amount)).join(", ")}`, bubble({
    header: header("สลิปนี้เคยบันทึกแล้ว"),
    body: box("vertical", [
      text("เพื่อไม่ให้ยอดซ้ำ เป๋าเป๋าจะไม่บันทึกสลิปเดิมอีกครั้งครับ", { color: COLORS.muted, size: "xs" }),
      ...duplicates.slice(0, FLEX_LIMITS.rows).map(d => box("horizontal", [
        text(`บันทึกเมื่อ ${bkkDate(d.date)}`, { color: COLORS.muted }),
        text(baht(d.amount), { weight: "bold", align: "end" }),
      ])),
    ], { spacing: "md", paddingAll: "16px" }),
  }))
}

/** Pro switched on, by payment or by starting the trial. */
export function proActivatedCard(opts: { expiresAt: Date; kind: "MONTHLY" | "YEARLY" | "TRIAL"; billsUrl: string; plansUrl: string }): FlexMessage {
  const { expiresAt, kind, billsUrl, plansUrl } = opts
  const title = kind === "TRIAL" ? "เริ่มทดลองใช้ Pro แล้ว 🎉" : "ชำระเงินสำเร็จ 🎉"
  const perks = ["ส่งรูปสลิป บันทึกให้อัตโนมัติ", "บิลประจำ เป๋าเป๋าถามให้ทาง LINE", "สรุปการเงินทุกเช้า", "นำเข้า Statement ธนาคาร"]
  return flex(`${title} ใช้ PaoPao Pro ได้ถึง ${bkkDate(expiresAt)}`, bubble({
    header: box("vertical", [
      text("PaoPao Pro", { weight: "bold", size: "xl", color: "#FFFFFF" }),
      text(title, { size: "sm", color: "#FFFFFF" }),
    ], { backgroundColor: COLORS.primary, paddingAll: "18px" }),
    body: box("vertical", [
      box("horizontal", [text("ใช้ได้ถึง", { color: COLORS.muted }), text(bkkDate(expiresAt), { weight: "bold", align: "end" })]),
      ...(kind === "TRIAL" ? [text("หมดแล้วกลับเป็น Free เอง ไม่มีการเก็บเงิน", { size: "xs", color: COLORS.muted })] : []),
      { type: "separator", color: COLORS.border, margin: "md" },
      ...perks.map(p => box("horizontal", [text("✓", { color: COLORS.primary, weight: "bold", flex: 0 }), text(p)], { spacing: "sm", margin: "sm" })),
    ], { spacing: "sm", paddingAll: "16px" }),
    footer: box("vertical", [uriButton("ตั้งบิลประจำ", billsUrl), uriButton("ดูแพ็กเกจ", plansUrl, false)], { spacing: "sm" }),
  }))
}

/** A Free user sent a photo: explain the plan, offer the trial and the upgrade. */
export function upsellCard(opts: { wasOtherSlip: boolean; trialEligible: boolean; trialDays: number; monthly: { priceThb: number; days: number }; yearlyThb: number; plansUrl: string }): FlexMessage {
  const { wasOtherSlip, trialEligible, trialDays, monthly, yearlyThb, plansUrl } = opts
  const buttons: messagingApi.FlexButton[] = []
  if (trialEligible) buttons.push(actionButton({ type: "message", label: `ทดลอง Pro ฟรี ${trialDays} วัน`, text: "ทดลองใช้" }, true))
  buttons.push(uriButton("ดูแพ็กเกจและวิธีชำระ", plansUrl, !trialEligible))
  return flex(`${wasOtherSlip ? "สลิปนี้ไม่ใช่การชำระค่า Pro · " : ""}แพ็กเกจ Free บันทึกด้วยการพิมพ์ เช่น "กาแฟ 65"`, bubble({
    header: header(wasOtherSlip ? "สลิปนี้ไม่ใช่ค่า Pro" : "ส่งรูปสลิปเป็นฟีเจอร์ Pro"),
    body: box("vertical", [
      text("แพ็กเกจ Free บันทึกด้วยการพิมพ์ได้เลย", { weight: "bold" }),
      box("vertical", [text("กาแฟ 65", { color: "#FFFFFF", size: "sm" })], { backgroundColor: "#06C755", cornerRadius: "12px", paddingAll: "8px", paddingStart: "12px", paddingEnd: "12px", margin: "sm", width: "90px" }),
      { type: "separator", color: COLORS.border, margin: "lg" },
      text(`Pro ฿${monthly.priceThb}/${monthly.days} วัน หรือ ฿${yearlyThb}/ปี`, { weight: "bold", margin: "lg" }),
      text("ส่งรูปสลิป · บิลประจำที่ถามให้ · สรุปทุกเช้า · นำเข้า Statement", { size: "xs", color: COLORS.muted }),
      text("จ่ายผ่านพร้อมเพย์แล้วส่งสลิปในแชทนี้ ไม่ตัดเงินอัตโนมัติ", { size: "xs", color: COLORS.muted }),
    ], { spacing: "sm", paddingAll: "16px" }),
    footer: box("vertical", buttons, { spacing: "sm" }),
  }))
}

type AskBill = { id: string; name: string; amount: number | null }
type BillAction = { label: string; data: string; displayText: string }

/** Bills due today, one tappable row each. The quick replies carry the same actions. */
export function billQuestionCard(bills: AskBill[], actions: BillAction[], quickReply: messagingApi.QuickReply, billsUrl: string): FlexMessage {
  const rows: FlexComponent[] = bills.slice(0, FLEX_LIMITS.rows).map((b, i) => box("horizontal", [
    box("vertical", [
      text(b.name, { weight: "bold" }),
      text(b.amount ? `ปกติ ${baht(b.amount)}` : "ยังไม่มียอดปกติ", { size: "xs", color: COLORS.muted }),
    ], { flex: 1 }),
    {
      type: "button", style: "primary", color: COLORS.primary, height: "sm", flex: 0, gravity: "center",
      action: { type: "postback", label: b.amount ? "จ่ายแล้ว" : "ใส่ยอด", data: actions[i].data, displayText: actions[i].displayText },
    },
  ], { spacing: "md", alignItems: "center" }))
  return flex(`ถึงรอบรายการประจำ: ${bills.map(b => b.name).join(", ")}`, bubble({
    header: header("🧾 ถึงรอบรายการประจำ"),
    body: box("vertical", [
      ...rows,
      text(`ยอดไม่ตรง พิมพ์เองได้ เช่น "${bills[0]?.name ?? "ค่าไฟ"} 920"`, { size: "xs", color: COLORS.muted, margin: "md" }),
    ], { spacing: "lg", paddingAll: "16px" }),
    footer: box("vertical", [uriButton("จัดการบิลประจำ", billsUrl, false)], { paddingTop: "0px" }),
  }), quickReply)
}

/** Morning brief for yesterday (Pro). */
export function morningBriefCard(transactions: Parameters<typeof summarizeDay>[0], day: Date, dashboardUrl: string): FlexMessage {
  const { spent, income, topCategories, tip } = summarizeDay(transactions)
  const stat = (label: string, value: string, color: string): FlexBox =>
    box("vertical", [text(label, { size: "xs", color: COLORS.muted }), text(value, { size: "xl", weight: "bold", color, wrap: false })], { flex: 1 })
  const top = topCategories.slice(0, 3)
  const max = top[0]?.amount || 1
  return flex(buildMorningBrief(transactions).replace(/\n/g, " "), bubble({
    header: header("🌅 สรุปเมื่อวาน", bkkDate(day)),
    body: box("vertical", [
      box("horizontal", [stat("ใช้ไป", baht(Math.round(spent)), COLORS.expense), stat("รับเข้า", baht(Math.round(income)), COLORS.income)], { spacing: "md" }),
      ...(top.length ? [
        { type: "separator" as const, color: COLORS.border, margin: "lg" },
        text("จ่ายมากสุด", { size: "xs", color: COLORS.muted, margin: "lg" }),
        ...top.map(c => box("vertical", [
          box("horizontal", [text(c.label), text(baht(Math.round(c.amount)), { align: "end", weight: "bold" })]),
          progressBar((c.amount / max) * 100, c.color || COLORS.primary),
        ], { margin: "md" })),
      ] : []),
      callout(spent === 0 ? (income > 0 ? "เมื่อวานไม่มีรายจ่ายเลย 💰" : "เมื่อวานไม่มียอดใช้จ่ายเลย เก่งมาก 🎉") + `\n${tip}` : `💡 ${tip}`, "info"),
    ], { paddingAll: "16px" }),
    footer: box("vertical", [uriButton("ดูแดชบอร์ด", dashboardUrl, false)], { paddingTop: "0px" }),
  }))
}

/** Reply to "login": opens the dashboard in LINE with one tap; on a computer, sign in with LINE on the website. */
export function loginCard(liffUrl: string, webLoginUrl: string): FlexMessage {
  return flex("เข้าสู่แดชบอร์ดเป๋าเป๋า", bubble({
    header: header("เข้าสู่แดชบอร์ด"),
    body: box("vertical", [
      text("แตะปุ่มด้านล่างเพื่อเปิดแดชบอร์ดใน LINE ได้เลย"),
      text(`บนคอมพิวเตอร์ เข้า ${webLoginUrl.replace(/^https:\/\//, "")} แล้วกด "เข้าสู่ระบบด้วย LINE"`, { size: "xs", color: COLORS.muted }),
    ], { spacing: "sm", paddingAll: "16px" }),
    footer: box("vertical", [uriButton("เปิดแดชบอร์ด", liffUrl)]),
  }))
}
