/**
 * LINE messages PaoPao sends in groups: bills to split and who owes whom. Pure builders, in the
 * style of src/lib/line-cards.ts. Every one of these is sent as a reply (free), never a push,
 * except the weekly reminder (src/app/api/cron/digest).
 */
import type { messagingApi } from "@line/bot-sdk"
import { actionButton, baht, box, bubble, callout, clip, COLORS, flex, FLEX_LIMITS, header, text, uriButton } from "@/lib/line-cards"
import { encodeGroupAction, GROUP_LIMITS } from "@/lib/group-split"

type FlexMessage = messagingApi.FlexMessage

export function groupWelcomeCard(): FlexMessage {
  const step = (n: string, title: string, detail: string) => box("horizontal", [
    text(n, { weight: "bold", color: COLORS.primary, flex: 0 }),
    box("vertical", [text(title, { weight: "bold" }), text(detail, { size: "xs", color: COLORS.muted })], { flex: 1 }),
  ], { spacing: "md" })
  return flex("เป๋าเป๋าช่วยแยกบิลและทวงเงินในกลุ่มนี้", bubble({
    header: header("เป๋าเป๋า แยกบิลในกลุ่ม"),
    body: box("vertical", [
      step("1", "พิมพ์ \"แยกบิล\" แล้วส่งรูปใบเสร็จ", "หรือตอบกลับรูปใบเสร็จด้วยคำว่า \"แยกบิล\" · ไม่มีใบเสร็จ พิมพ์ \"แยกบิล 1200 ค่าห้อง\""),
      step("2", "ทุกคนติ๊กรายการของตัวเอง", "เป๋าเป๋าคิดยอดให้ รวม VAT และ service charge"),
      step("3", "โอนแล้วส่งสลิปในกลุ่ม", "ยอดตรง ปิดหนี้ให้อัตโนมัติ · พิมพ์ \"ยอดค้าง\" เพื่อดูว่าใครยังไม่จ่าย"),
      text("เป๋าเป๋าจะไม่อ่านแชทอื่นในกลุ่ม", { size: "xs", color: COLORS.muted, margin: "md" }),
    ], { spacing: "lg", paddingAll: "16px" }),
  }))
}

/** LINE URL schemes that open the camera / photo picker and send the photo to the current chat */
export const CAMERA_URL = "https://line.me/R/nv/camera/"
export const CAMERA_ROLL_URL = "https://line.me/R/nv/cameraRoll/single"

/**
 * Reply to "แยกบิล": buttons that open the camera or the photo album. Flex buttons can't use LINE's
 * camera actions, so they open LINE's own camera links; the quick-reply chips use the camera
 * actions themselves, as a second way in.
 */
export function armedCard(): FlexMessage {
  return flex("ส่งรูปใบเสร็จมาได้เลย (ภายใน 3 นาที)", bubble({
    header: header("🧾 ส่งรูปใบเสร็จ", "ภายใน 3 นาที"),
    body: box("vertical", [
      text("ถ่ายรูปใบเสร็จให้เห็นรายการและยอดรวม หรือเลือกรูปจากอัลบั้ม ใครในกลุ่มส่งก็ได้"),
      text("ไม่มีใบเสร็จ? พิมพ์ \"แยกบิล 1200 ค่าอาหาร\" เพื่อหารเท่ากัน", { size: "xs", color: COLORS.muted }),
    ], { spacing: "sm", paddingAll: "16px" }),
    footer: box("vertical", [
      uriButton("📷 ถ่ายรูปใบเสร็จ", CAMERA_URL),
      uriButton("🖼️ เลือกจากอัลบั้ม", CAMERA_ROLL_URL, false),
    ], { spacing: "sm" }),
  }), {
    items: [
      { type: "action", action: { type: "camera", label: "ถ่ายรูป" } },
      { type: "action", action: { type: "cameraRoll", label: "เลือกจากอัลบั้ม" } },
    ],
  })
}

export function billCard(opts: { title: string; total: number; itemCount: number; payerName: string; url: string; warning?: string }): FlexMessage {
  return flex(`แยกบิล ${opts.title} ${baht(opts.total)}: กดเลือกรายการของคุณ`, bubble({
    header: header("🧾 แยกบิล", `${opts.itemCount} รายการ`),
    body: box("vertical", [
      text(clip(opts.title, 60), { weight: "bold", size: "md" }),
      text(baht(opts.total), { weight: "bold", size: "xxl", color: COLORS.primary }),
      text(`${opts.payerName} เป็นคนจ่าย · ทุกคนกดปุ่มด้านล่างแล้วติ๊กรายการของตัวเอง`, { size: "xs", color: COLORS.muted }),
      ...(opts.warning ? [callout(opts.warning, "warn")] : []),
    ], { spacing: "sm", paddingAll: "16px" }),
    footer: box("vertical", [uriButton("เลือกรายการของฉัน", opts.url)]),
  }))
}

export type DebtRow = { debtId: string; debtorName: string; creditorName: string; amount: number; billTitle: string; claimed: boolean }

/** Who still owes whom in this group, with "I paid" buttons and a remind-everyone button. */
export function debtsCard(rows: DebtRow[], opts: { url?: string; title?: string } = {}): FlexMessage | messagingApi.TextMessage {
  if (rows.length === 0) return { type: "text", text: "ไม่มียอดค้างในกลุ่มนี้แล้ว 🎉" }
  const shown = rows.slice(0, FLEX_LIMITS.rows)
  const total = rows.reduce((s, r) => s + r.amount, 0)
  return flex(`ยอดค้างในกลุ่ม ${baht(total)} (${rows.length} รายการ)`, bubble({
    header: header(opts.title ?? "ยอดค้างในกลุ่ม", baht(total)),
    body: box("vertical", [
      ...shown.map(r => box("horizontal", [
        box("vertical", [
          text(`${clip(r.debtorName, 18)} → ${clip(r.creditorName, 18)}`, { weight: "bold" }),
          text(`${clip(r.billTitle, 30)}${r.claimed ? " · รอยืนยันว่าได้รับ" : ""}`, { size: "xs", color: r.claimed ? COLORS.warnText : COLORS.muted }),
        ], { flex: 1 }),
        box("vertical", [
          text(baht(r.amount), { weight: "bold", align: "end", color: COLORS.expense }),
          ...(r.claimed ? [] : [text("จ่ายแล้ว", {
            size: "xs", align: "end", color: COLORS.primary, decoration: "underline",
            action: { type: "postback", label: "จ่ายแล้ว", data: encodeGroupAction({ kind: "paid", debtId: r.debtId }), displayText: `จ่ายแล้ว ${baht(r.amount)}` },
          })]),
        ], { flex: 0 }),
      ], { spacing: "md" })),
      ...(rows.length > shown.length ? [text(`และอีก ${rows.length - shown.length} รายการ`, { size: "xs", color: COLORS.muted })] : []),
      text("โอนแล้วส่งสลิปในกลุ่มได้เลย ยอดตรงจะปิดให้อัตโนมัติ · จ่ายเงินสดกด \"จ่ายแล้ว\"", { size: "xs", color: COLORS.muted, margin: "md" }),
    ], { spacing: "md", paddingAll: "16px" }),
    footer: box("vertical", [
      actionButton({ type: "postback", label: "ทวงทุกคน", data: encodeGroupAction({ kind: "remind" }), displayText: "ทวงทุกคน" }, true),
      ...(opts.url ? [uriButton("ดู QR พร้อมเพย์และรายละเอียด", opts.url, false)] : []),
    ], { spacing: "sm" }),
  }))
}

/**
 * Reminder that @mentions everyone who owes (LINE notifies them). Mentions only work in textV2;
 * LINE allows 20 per message.
 */
export function remindMessage(rows: { debtorId: string; creditorName: string; amount: number }[]): messagingApi.TextMessageV2 | messagingApi.TextMessage {
  const byDebtor = new Map<string, { creditorName: string; amount: number }[]>()
  for (const r of rows) byDebtor.set(r.debtorId, [...(byDebtor.get(r.debtorId) ?? []), r])
  const debtors = [...byDebtor].slice(0, 20)
  if (debtors.length === 0) return { type: "text", text: "ไม่มียอดค้างในกลุ่มนี้แล้ว 🎉" }
  const substitution: Record<string, messagingApi.SubstitutionObject> = {}
  const lines = debtors.map(([debtorId, debts], i) => {
    substitution[`u${i}`] = { type: "mention", mentionee: { type: "user", userId: debtorId } } as messagingApi.MentionSubstitutionObject
    const owed = debts.map(d => `${baht(d.amount)} ให้ ${d.creditorName}`).join(", ")
    return `{u${i}} ค้าง ${owed}`
  })
  return { type: "textV2", text: clip(`⏰ ทวงหน่อยนะ\n${lines.join("\n")}\nโอนแล้วส่งสลิปในกลุ่มได้เลย`, 5000), substitution }
}

/** Debtor said they paid without a slip: the creditor confirms or not. */
export function claimCard(opts: { debtId: string; debtorName: string; creditorName: string; amount: number }): FlexMessage {
  return flex(`${opts.debtorName} บอกว่าจ่าย ${baht(opts.amount)} แล้ว รอ ${opts.creditorName} ยืนยัน`, bubble({
    body: box("vertical", [
      text(`${opts.debtorName} บอกว่าจ่ายแล้ว`, { weight: "bold" }),
      text(`${baht(opts.amount)} ให้ ${opts.creditorName} · ${opts.creditorName} กดยืนยันเมื่อได้รับเงิน`, { size: "xs", color: COLORS.muted }),
    ], { spacing: "sm", paddingAll: "16px" }),
    footer: box("horizontal", [
      actionButton({ type: "postback", label: "ได้รับแล้ว", data: encodeGroupAction({ kind: "confirm", debtId: opts.debtId }), displayText: "ได้รับเงินแล้ว" }, true),
      actionButton({ type: "postback", label: "ยังไม่ได้รับ", data: encodeGroupAction({ kind: "reject", debtId: opts.debtId }), displayText: "ยังไม่ได้รับ" }),
    ], { spacing: "sm" }),
  }))
}

/** A repayment slip matched open debts and closed them. The creditor can undo. */
export function slipPaidCard(opts: { debtorName: string; creditorName: string; amount: number; billTitles: string[]; firstDebtId: string }): FlexMessage {
  return flex(`✅ ${opts.debtorName} จ่าย ${baht(opts.amount)} ให้ ${opts.creditorName} แล้ว`, bubble({
    body: box("vertical", [
      text(`✅ ${opts.debtorName} จ่ายแล้ว ${baht(opts.amount)}`, { weight: "bold", color: COLORS.income }),
      text(`ให้ ${opts.creditorName} · ${clip(opts.billTitles.join(", "), 80)}`, { size: "xs", color: COLORS.muted }),
      text("ตรวจสลิปกับธนาคารแล้ว ถ้าไม่ใช่ยอดนี้ เจ้าของเงินกดยกเลิกได้", { size: "xs", color: COLORS.muted }),
    ], { spacing: "sm", paddingAll: "16px" }),
    footer: box("vertical", [
      actionButton({ type: "postback", label: "ยกเลิก (ยังไม่ได้รับ)", data: encodeGroupAction({ kind: "reject", debtId: opts.firstDebtId }), displayText: "ยกเลิก ยังไม่ได้รับ" }),
    ]),
  }))
}

export function receiptLimitMessage(): messagingApi.TextMessage {
  return {
    type: "text",
    text: `กลุ่มนี้อ่านใบเสร็จฟรีครบ ${GROUP_LIMITS.freeReceiptsPerMonth} ใบของเดือนนี้แล้ว 🙏\n` +
      `ถ้าคนส่งใบเสร็จเป็นสมาชิก Pro อ่านได้ไม่จำกัด · หรือพิมพ์ "แยกบิล 1200 ค่าอาหาร" เพื่อหารเท่ากันได้เลย`,
  }
}
