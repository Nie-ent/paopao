/** Features tracked in FeatureEvent (src/lib/feature-events.ts), grouped for the admin page. Safe in client code. */

export const FEATURES = {
  // LINE chat with PaoPao
  line_entry_quick: { label: "พิมพ์รายการ (ไม่ใช้ AI)", group: "LINE" },
  line_entry_ai: { label: "พิมพ์รายการ (AI อ่าน)", group: "LINE" },
  line_slip: { label: "ส่งสลิป", group: "LINE" },
  line_summary: { label: "ขอสรุป", group: "LINE" },
  line_invite: { label: "ขอลิงก์ชวนเพื่อน", group: "LINE" },
  line_bill_answer: { label: "ตอบบิลประจำ", group: "LINE" },
  line_pro_payment: { label: "จ่าย Pro ด้วยสลิป", group: "LINE" },
  // Web / LIFF dashboard
  web_entry: { label: "เพิ่มรายการบนเว็บ", group: "เว็บ" },
  web_chat: { label: "แชท AI", group: "เว็บ" },
  web_insight: { label: "Insight หน้าแรก", group: "เว็บ" },
  web_advice: { label: "คำแนะนำการเงิน AI", group: "เว็บ" },
  web_statement: { label: "นำเข้า statement", group: "เว็บ" },
  web_goal: { label: "สร้างเป้าหมาย", group: "เว็บ" },
  web_recurring_bill: { label: "บันทึกค่าใช้จ่ายประจำ", group: "เว็บ" },
  web_quest: { label: "รับรางวัลภารกิจ", group: "เว็บ" },
  web_reward: { label: "แลกของรางวัล", group: "เว็บ" },
  trial_start: { label: "เริ่มทดลอง Pro", group: "เว็บ" },
  // LINE groups
  group_join: { label: "เชิญบอทเข้ากลุ่ม", group: "กลุ่ม" },
  group_receipt: { label: "แยกบิลจากใบเสร็จ", group: "กลุ่ม" },
  group_amount_bill: { label: "แยกบิลแบบใส่ยอด", group: "กลุ่ม" },
  group_claim: { label: "ติ๊กรายการ", group: "กลุ่ม" },
  group_close: { label: "ปิดบิล", group: "กลุ่ม" },
  group_slip_paid: { label: "ปิดหนี้ด้วยสลิป", group: "กลุ่ม" },
  group_paid_claim: { label: "กดจ่ายแล้ว (เงินสด)", group: "กลุ่ม" },
  group_remind: { label: "ทวงเงิน", group: "กลุ่ม" },
  group_payout: { label: "ตั้งช่องทางรับเงิน", group: "กลุ่ม" },
} as const

export type FeatureKey = keyof typeof FEATURES

/** Readable name for a stored feature key, including page views ("page:/bills"). */
export function featureLabel(key: string) {
  if (key in FEATURES) return FEATURES[key as FeatureKey].label
  if (key.startsWith("page:")) return `เปิดหน้า ${PAGE_LABELS[key.slice(5)] ?? key.slice(5)}`
  return key
}

export function featureGroup(key: string) {
  if (key in FEATURES) return FEATURES[key as FeatureKey].group
  return key.startsWith("page:") ? "หน้าเว็บ" : "อื่นๆ"
}

const PAGE_LABELS: Record<string, string> = {
  "/": "แดชบอร์ด", "/transactions": "รายการ", "/bills": "ค่าใช้จ่ายคงที่", "/goals": "เป้าหมาย", "/chat": "แชท AI",
  "/ai-insights": "คำแนะนำ AI", "/rewards": "รางวัล", "/subscription": "แพ็กเกจ", "/invite": "ชวนเพื่อน", "/settings": "ตั้งค่า", "/updates": "อัปเดต",
}
