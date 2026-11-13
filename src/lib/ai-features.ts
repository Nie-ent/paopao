/** AI features as recorded in AiUsage.feature (src/lib/ai-usage.ts). Safe to import in client code. */

/** What the AI call was for. Stored as text, so new features need no migration. */
export type AiFeature =
  | "entry_text"
  | "slip"
  | "statement"
  | "chat"
  | "chat_title"
  | "insight"
  | "advice"
  | "group_receipt"

export const AI_FEATURE_LABELS: Record<AiFeature, string> = {
  entry_text: "อ่านข้อความรายการ",
  slip: "อ่านสลิป",
  statement: "นำเข้า statement",
  chat: "แชท AI",
  chat_title: "ตั้งชื่อแชท",
  insight: "Insight หน้าแรก",
  advice: "คำแนะนำการเงิน",
  group_receipt: "อ่านใบเสร็จในกลุ่ม",
}
