/**
 * LINE Flex Message cards for the bot's replies, in the app's theme. Pure builders: each returns
 * a complete message (with altText, the text shown in notifications and the chat list).
 * Layout spec: https://developers.line.biz/en/reference/messaging-api/#flex-message
 */
import type { messagingApi } from "@line/bot-sdk"
import { th } from "@/i18n/messages"
import { siteUrl } from "@/lib/site"
import { buildMorningBrief, summarizeDay } from "@/lib/morning-brief"
import { encodeSummaryAnswer, SUMMARY_PERIODS, type Summary, type SummaryPeriod } from "@/lib/summary"
import { EDITABLE_ITEMS, encodeEntryAction, type DraftItem } from "@/lib/pending-entry"

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
export function recordedCard(opts: { items: RecordedItem[]; dashboardUrl: string; now?: Date; budgetRatio?: number | null; duplicates?: Duplicate[]; notices?: string[] }): FlexMessage {
  const { items, dashboardUrl, now = new Date(), budgetRatio, duplicates = [], notices = [] } = opts
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
  for (const notice of notices) rows.push(callout(notice, "warn"))

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

// ---------- confirm before saving ----------

const postback = (label: string, data: string, displayText?: string): messagingApi.PostbackAction =>
  ({ type: "postback", label: clip(label, FLEX_LIMITS.buttonLabel), data, ...(displayText ? { displayText } : {}) })

const smallButton = (action: Action): messagingApi.FlexButton =>
  ({ type: "button", style: "link", color: COLORS.primary, height: "sm", action, flex: 1 })

/**
 * What the bot read, before anything is saved: each item with "change amount", "change category"
 * and "income ↔ expense", then confirm or cancel. Only confirm writes to the database.
 */
export function confirmCard(opts: { draftId: string; items: (DraftItem & { categoryColor?: string | null })[]; notices?: string[] }): FlexMessage {
  const { draftId, items, notices = [] } = opts
  const editable = items.length <= EDITABLE_ITEMS
  const shown = items.slice(0, FLEX_LIMITS.rows)
  const rows: FlexComponent[] = []
  shown.forEach((item, index) => {
    if (index > 0) rows.push({ type: "separator", color: COLORS.border, margin: "md" })
    const income = item.type === "INCOME"
    rows.push(box("horizontal", [
      dot(item.categoryColor || (income ? COLORS.income : COLORS.expense)),
      box("vertical", [
        text(categoryLabel(item.category), { weight: "bold" }),
        text(`${income ? "รายรับ" : "รายจ่าย"}${item.note ? ` · ${item.note}` : ""}`, { size: "xs", color: COLORS.muted }),
      ], { flex: 1 }),
      text(`${income ? "+" : "−"}${baht(item.amount)}`, { weight: "bold", size: "md", align: "end", flex: 0, wrap: false, color: income ? COLORS.income : COLORS.expense }),
    ], { spacing: "md", margin: index > 0 ? "md" : "none" }))
    if (editable) {
      rows.push(box("horizontal", [
        smallButton(postback("แก้ยอด", encodeEntryAction({ action: "amount", draftId, index }), "แก้ยอด")),
        smallButton(postback("เปลี่ยนหมวด", encodeEntryAction({ action: "pickCategory", draftId, index }), "เปลี่ยนหมวด")),
        smallButton(postback(income ? "เป็นรายจ่าย" : "เป็นรายรับ", encodeEntryAction({ action: "flipType", draftId, index }))),
      ], { spacing: "xs", margin: "xs" }))
    }
  })
  if (items.length > shown.length) rows.push(text(`และอีก ${items.length - shown.length} รายการ`, { size: "xs", color: COLORS.muted, margin: "md" }))
  if (items.length > 1) {
    const spent = items.filter(i => i.type === "EXPENSE").reduce((s, i) => s + i.amount, 0)
    const earned = items.filter(i => i.type === "INCOME").reduce((s, i) => s + i.amount, 0)
    rows.push({ type: "separator", color: COLORS.border, margin: "md" })
    if (spent) rows.push(box("horizontal", [text("รวมรายจ่าย", { color: COLORS.muted }), text(`−${baht(spent)}`, { weight: "bold", align: "end", color: COLORS.expense })], { margin: "md" }))
    if (earned) rows.push(box("horizontal", [text("รวมรายรับ", { color: COLORS.muted }), text(`+${baht(earned)}`, { weight: "bold", align: "end", color: COLORS.income })], { margin: spent ? "sm" : "md" }))
  }
  for (const notice of notices) rows.push(callout(notice, "warn"))

  const first = items[0]
  const alt = items.length === 1
    ? `ยืนยันบันทึก: ${categoryLabel(first.category)} ${first.type === "INCOME" ? "+" : "−"}${baht(first.amount)}${first.note ? ` (${first.note})` : ""}`
    : `ยืนยันบันทึก ${items.length} รายการ`
  return flex(alt, bubble({
    header: header("ตรวจสอบก่อนบันทึก", items.length > 1 ? `${items.length} รายการ` : undefined),
    body: box("vertical", rows, { spacing: "sm", paddingAll: "16px" }),
    footer: box("vertical", [
      actionButton(postback(items.length > 1 ? `✓ บันทึกทั้ง ${items.length} รายการ` : "✓ ยืนยันบันทึก", encodeEntryAction({ action: "save", draftId }), "ยืนยันบันทึก"), true),
      smallButton(postback("ยกเลิก", encodeEntryAction({ action: "cancel", draftId }), "ยกเลิก")),
    ], { spacing: "sm", paddingTop: "0px" }),
  }))
}

/** Quick-reply buttons to pick another category for one draft item */
export function categoryPickerMessage(draftId: string, index: number, item: DraftItem, choices: string[]): messagingApi.TextMessage {
  return {
    type: "text",
    text: `เลือกหมวดใหม่ให้ "${item.note || categoryLabel(item.category)}" (ตอนนี้: ${categoryLabel(item.category)}) จากปุ่มด้านล่างครับ`,
    quickReply: {
      items: choices.slice(0, 13).map(category => ({
        type: "action" as const,
        action: postback(clip(categoryLabel(category), FLEX_LIMITS.quickReplyLabel), encodeEntryAction({ action: "setCategory", draftId, index, category }), categoryLabel(category)),
      })),
    },
  }
}

/** Asks for the corrected amount; the next number the user types replaces it */
export function askAmountMessage(item: DraftItem): messagingApi.TextMessage {
  return { type: "text", text: `พิมพ์ยอดที่ถูกต้องของ "${item.note || categoryLabel(item.category)}" ได้เลยครับ (ตอนนี้ ${baht(item.amount)})
เช่น 1,250 หรือ 80` }
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
  const perks = ["ส่งรูปสลิป บันทึกให้อัตโนมัติ", "บิลประจำ เป๋าเป๋าถามให้ทาง LINE", "สรุปการเงินทาง LINE", "นำเข้า Statement ธนาคาร"]
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

/**
 * Sent when someone adds PaoPao as a friend: how to use it in three steps, with a "try it" button
 * that sends a sample entry (it only becomes a draft to confirm, nothing is saved by itself).
 */
export function welcomeCard(opts: { name?: string | null; proUntil: Date | null; trialEligible: boolean; trialDays: number; dashboardUrl: string }): FlexMessage {
  const { name, proUntil, trialEligible, trialDays, dashboardUrl } = opts
  const hello = name && name !== "LINE User" ? `สวัสดีครับคุณ${name.split(/\s+/)[0]} 👋` : "สวัสดีครับ 👋"
  const step = (n: number, title: string, detail: string): FlexBox => box("horizontal", [
    box("vertical", [text(String(n), { size: "sm", weight: "bold", color: "#FFFFFF", align: "center" })],
      { width: "24px", height: "24px", cornerRadius: "12px", backgroundColor: COLORS.primary, justifyContent: "center", flex: 0 }),
    box("vertical", [text(title, { weight: "bold", size: "sm" }), text(detail, { size: "xs", color: COLORS.muted, wrap: true })], { spacing: "xs" }),
  ], { spacing: "md", margin: "lg" })
  const proLine = proUntil
    ? `⭐ คุณใช้ Pro ได้ถึง ${bkkDate(proUntil)}: ส่งรูปสลิปมาบันทึกได้เลย`
    : trialEligible
      ? `⭐ พิมพ์ "ทดลองใช้" เพื่อใช้ Pro ฟรี ${trialDays} วัน (ส่งรูปสลิป บิลประจำ แชทกับ AI)`
      : "⭐ อัปเกรด Pro เพื่อส่งรูปสลิป บิลประจำ และแชทกับ AI"
  const quick: messagingApi.QuickReply = { items: [
    { type: "action", action: { type: "message", label: "สรุป", text: "สรุป" } },
    { type: "action", action: { type: "message", label: "ส่งสลิป", text: "ส่งสลิป" } },
    ...(trialEligible && !proUntil ? [{ type: "action" as const, action: { type: "message" as const, label: "ทดลองใช้ Pro", text: "ทดลองใช้" } }] : []),
    { type: "action", action: { type: "message", label: "ชวนเพื่อน", text: "ชวนเพื่อน" } },
  ] }
  return flex(`${hello} เป๋าเป๋าช่วยจดรายรับรายจ่ายใน LINE: พิมพ์ "กาแฟ 65" แล้วแตะบันทึก พิมพ์ "สรุป" เพื่อดูยอด`, bubble({
    header: box("horizontal", [
      // PaoPao's face (public/line/paopao-face.png, 240px so LINE loads it fast)
      box("vertical", [{ type: "image", url: `${siteUrl()}/line/paopao-face.png`, size: "full", aspectMode: "cover", aspectRatio: "1:1" }],
        { width: "56px", height: "56px", cornerRadius: "16px", flex: 0 }),
      box("vertical", [
        text("ยินดีต้อนรับสู่เป๋าเป๋า", { weight: "bold", size: "lg", color: "#FFFFFF" }),
        text(hello, { size: "sm", color: "#FFFFFF" }),
      ], { justifyContent: "center" }),
    ], { spacing: "md", backgroundColor: COLORS.primary, paddingAll: "16px" }),
    body: box("vertical", [
      text("จดรายรับรายจ่ายได้ในแชทนี้เลย แค่ 3 ขั้น", { size: "sm", wrap: true }),
      step(1, "พิมพ์รายการกับยอดเงิน", `เช่น "กาแฟ 65" หรือ "ข้าว 50 ชาไทย 35" รายรับก็พิมพ์ได้ เช่น "เงินเดือน 25000"`),
      step(2, "ตรวจการ์ดแล้วแตะบันทึก", "แก้ยอด เปลี่ยนหมวด หรือสลับรายรับ/รายจ่ายได้ก่อนบันทึก"),
      step(3, "ดูภาพรวม", `พิมพ์ "สรุป" ดูยอดวันนี้ เดือนนี้ ปีนี้ หรือเปิดแดชบอร์ดดูกราฟและเป้าหมาย`),
      { type: "separator", color: COLORS.border, margin: "lg" },
      text(proLine, { size: "xs", color: COLORS.muted, wrap: true, margin: "lg" }),
    ], { paddingAll: "16px" }),
    footer: box("vertical", [
      actionButton({ type: "message", label: "ลองบันทึก \"กาแฟ 65\"", text: "กาแฟ 65" }, true),
      uriButton("เปิดแดชบอร์ด", dashboardUrl, false),
    ], { spacing: "sm" }),
  }), quick)
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
      text("ส่งรูปสลิป · บิลประจำที่ถามให้ · สรุปการเงินทาง LINE · นำเข้า Statement", { size: "xs", color: COLORS.muted }),
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

/** LINE summary for yesterday or last week (Pro). */
export function morningBriefCard(transactions: Parameters<typeof summarizeDay>[0], day: Date, dashboardUrl: string, period: "DAY" | "WEEK" = "DAY", end?: Date): FlexMessage {
  const when = period === "WEEK" ? "สัปดาห์ที่แล้ว" : "เมื่อวาน"
  const { spent, income, topCategories, tip } = summarizeDay(transactions)
  const stat = (label: string, value: string, color: string): FlexBox =>
    box("vertical", [text(label, { size: "xs", color: COLORS.muted }), text(value, { size: "xl", weight: "bold", color, wrap: false })], { flex: 1 })
  const top = topCategories.slice(0, 3)
  const max = top[0]?.amount || 1
  const dateNote = period === "WEEK" && end ? `${bkkDate(day)} – ${bkkDate(new Date(end.getTime() - 1))}` : bkkDate(day)
  return flex(buildMorningBrief(transactions, period).replace(/\n/g, " "), bubble({
    header: header(period === "WEEK" ? "📅 สรุปสัปดาห์ที่แล้ว" : "🌅 สรุปเมื่อวาน", dateNote),
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
      callout(spent === 0 ? (income > 0 ? `${when}ไม่มีรายจ่ายเลย 💰` : `${when}ไม่มียอดใช้จ่ายเลย เก่งมาก 🎉`) + `\n${tip}` : `💡 ${tip}`, "info"),
    ], { paddingAll: "16px" }),
    footer: box("vertical", [uriButton("ดูแดชบอร์ด", dashboardUrl, false)], { paddingTop: "0px" }),
  }))
}

/** Reply to "ชวนเพื่อน": the user's invite link with a LINE share button and their progress. */
export function inviteCard(opts: { link: string; rewarded: number; maxRewards: number; rewardDays: number; friendTrialDays: number; qualifyDays: number; qualifyWindowDays: number; progressUrl: string }): FlexMessage {
  const { link, rewarded, maxRewards, rewardDays, friendTrialDays, qualifyDays, qualifyWindowDays, progressUrl } = opts
  const shareText = `เราใช้เป๋าเป๋าจดรายรับรายจ่ายใน LINE แค่พิมพ์ "กาแฟ 65" ก็บันทึกให้ สมัครผ่านลิงก์นี้ได้ทดลองใช้ Pro ฟรี ${friendTrialDays} วัน 👉 ${link}`
  const maxed = rewarded >= maxRewards
  return flex(`ชวนเพื่อน รับ Pro ฟรี: ${link}`, bubble({
    header: header("🎁 ชวนเพื่อน รับ Pro ฟรี", `${rewarded}/${maxRewards}`),
    body: box("vertical", [
      text(`เพื่อนที่สมัครผ่านลิงก์ของคุณได้ทดลอง Pro ฟรี ${friendTrialDays} วัน และเมื่อเพื่อนจดครบ ${qualifyDays} วันภายใน ${qualifyWindowDays} วัน คุณได้ Pro ฟรี ${rewardDays} วัน (สูงสุด ${maxRewards} คน)`, { wrap: true }),
      progressBar((rewarded / maxRewards) * 100, COLORS.primary),
      text(maxed ? "คุณรับรางวัลชวนเพื่อนครบแล้ว ขอบคุณที่บอกต่อนะครับ 🙏" : link, { size: "xs", color: COLORS.muted, wrap: true }),
    ], { spacing: "md", paddingAll: "16px" }),
    footer: box("vertical", [
      ...(maxed ? [] : [uriButton("ชวนเพื่อนใน LINE", `https://line.me/R/share?text=${encodeURIComponent(shareText)}`)]),
      uriButton("ดูความคืบหน้า", progressUrl, maxed),
    ], { spacing: "sm" }),
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

// ---------- summary ("สรุป") ----------

const PERIOD_LABEL: Record<SummaryPeriod, string> = { DAY: "วันนี้", MONTH: "เดือนนี้", YEAR: "ปีนี้" }

const periodAction = (p: SummaryPeriod, label = PERIOD_LABEL[p]): messagingApi.PostbackAction =>
  ({ type: "postback", label, data: encodeSummaryAnswer(p), displayText: `สรุป${PERIOD_LABEL[p]}` })

const periodQuickReply = (): messagingApi.QuickReply =>
  ({ items: SUMMARY_PERIODS.map(p => ({ type: "action" as const, action: periodAction(p, `สรุป${PERIOD_LABEL[p]}`) })) })

/** Reply to "สรุป": pick today, this month or this year. */
export function summaryPickerCard(): FlexMessage {
  return flex("ดูสรุปรายรับรายจ่าย: เลือกวันนี้ เดือนนี้ หรือปีนี้", bubble({
    header: header("📊 ดูสรุปรายรับรายจ่าย"),
    body: box("vertical", [text("อยากดูสรุปช่วงไหนครับ")], { paddingAll: "16px" }),
    footer: box("vertical", SUMMARY_PERIODS.map((p, i) => actionButton(periodAction(p, `สรุป${PERIOD_LABEL[p]}`), i === 1)), { spacing: "sm" }),
  }), periodQuickReply())
}

const CHART_HEIGHT = 64

/** One vertical bar, bottom-aligned in a fixed-height column. Zero draws a hairline so the axis reads. */
function vbar(value: number, max: number, color: string): FlexBox {
  const h = value > 0 ? Math.max(3, Math.round((value / max) * CHART_HEIGHT)) : 1
  return box("vertical", [box("vertical", [], { height: `${h}px`, backgroundColor: value > 0 ? color : COLORS.border, cornerRadius: "2px" })],
    { height: `${CHART_HEIGHT}px`, justifyContent: "flex-end", flex: 1 })
}

/** Daily spending for the month: one bar per day, labelled at the start, middle and end. */
function monthChart(buckets: { label: string; expense: number }[]): FlexComponent[] {
  const max = Math.max(...buckets.map(b => b.expense), 1)
  return [
    text("รายจ่ายรายวัน", { size: "xs", color: COLORS.muted, margin: "lg" }),
    box("horizontal", buckets.map(b => vbar(b.expense, max, COLORS.expense)), { spacing: "xs", margin: "sm" }),
    box("horizontal", [
      text("1", { size: "xxs", color: COLORS.muted, flex: 1 }),
      text(String(Math.ceil(buckets.length / 2)), { size: "xxs", color: COLORS.muted, align: "center", flex: 1 }),
      text(String(buckets.length), { size: "xxs", color: COLORS.muted, align: "end", flex: 1 }),
    ], { margin: "xs" }),
  ]
}

/** Income vs expense per month: a green and a red bar per month. */
function yearChart(buckets: { label: string; income: number; expense: number }[]): FlexComponent[] {
  const max = Math.max(...buckets.flatMap(b => [b.income, b.expense]), 1)
  return [
    box("horizontal", [
      text("รายรับ vs รายจ่าย รายเดือน", { size: "xs", color: COLORS.muted, flex: 1 }),
      text("● รับ", { size: "xxs", color: COLORS.income, flex: 0, wrap: false }),
      text("● จ่าย", { size: "xxs", color: COLORS.expense, flex: 0, wrap: false, margin: "sm" }),
    ], { margin: "lg" }),
    box("horizontal", buckets.map(b => box("horizontal", [vbar(b.income, max, COLORS.income), vbar(b.expense, max, COLORS.expense)], { flex: 1, spacing: "none" })), { spacing: "sm", margin: "sm" }),
    box("horizontal", buckets.map(b => text(b.label, { size: "xxs", color: COLORS.muted, align: "center", flex: 1, wrap: false, adjustMode: "shrink-to-fit" })), { spacing: "sm", margin: "xs" }),
  ]
}

/** The summary for a period: totals, a chart and the biggest expense categories. */
export function summaryCard(summary: Summary, dashboardUrl: string): FlexMessage {
  const { period, title, income, expense, net, count, buckets, topCategories } = summary
  const stat = (label: string, value: string, color: string): FlexBox =>
    box("vertical", [text(label, { size: "xs", color: COLORS.muted }), text(value, { size: "lg", weight: "bold", color, wrap: false, adjustMode: "shrink-to-fit" })], { flex: 1 })
  const round = (n: number) => baht(Math.round(n))

  const body: FlexComponent[] = count === 0
    ? [text(`ยังไม่มีรายการ${PERIOD_LABEL[period]}`, { weight: "bold" }), text(`พิมพ์บันทึกได้เลย เช่น "กาแฟ 65"`, { size: "xs", color: COLORS.muted })]
    : [
        box("horizontal", [stat("รายรับ", round(income), COLORS.income), stat("รายจ่าย", round(expense), COLORS.expense)], { spacing: "md" }),
        box("horizontal", [
          text("คงเหลือ", { color: COLORS.muted, flex: 1 }),
          text(`${net < 0 ? "−" : "+"}${round(Math.abs(net))}`, { weight: "bold", align: "end", color: net < 0 ? COLORS.expense : COLORS.income }),
        ], { margin: "md" }),
        ...(period === "MONTH" ? monthChart(buckets) : period === "YEAR" ? yearChart(buckets) : []),
        ...(topCategories.length ? [
          { type: "separator" as const, color: COLORS.border, margin: "lg" },
          text("จ่ายมากสุด", { size: "xs", color: COLORS.muted, margin: "lg" }),
          ...topCategories.slice(0, period === "DAY" ? 5 : 4).map(c => box("vertical", [
            box("horizontal", [text(categoryLabel(c.name), { flex: 1 }), text(round(c.amount), { align: "end", weight: "bold", flex: 0, wrap: false })]),
            progressBar((c.amount / topCategories[0].amount) * 100, c.color || COLORS.primary),
          ], { margin: "md" })),
        ] : []),
        text(`${count} รายการ`, { size: "xxs", color: COLORS.muted, align: "end", margin: "lg" }),
      ]

  const others = SUMMARY_PERIODS.filter(p => p !== period)
  const alt = count === 0
    ? `สรุป${PERIOD_LABEL[period]} (${title}): ยังไม่มีรายการ`
    : `สรุป${PERIOD_LABEL[period]} (${title}) รับ ${round(income)} จ่าย ${round(expense)} คงเหลือ ${net < 0 ? "−" : "+"}${round(Math.abs(net))}`
  return flex(alt, bubble({
    header: header(`📊 สรุป${PERIOD_LABEL[period]}`, title),
    body: box("vertical", body, { paddingAll: "16px" }),
    footer: box("vertical", [
      box("horizontal", others.map(p => ({ ...actionButton(periodAction(p, `ดู${PERIOD_LABEL[p]}`)), flex: 1 })), { spacing: "sm" }),
      uriButton("ดูแดชบอร์ด", dashboardUrl, false),
    ], { spacing: "sm" }),
  }), periodQuickReply())
}
