/**
 * "What's new" release notes, newest first. Signed-in users see the releases published since they
 * last dismissed the dialog (User.lastSeenRelease). To announce an update, add an entry at the
 * top with a new id (the date, plus a letter for a second release that day) and only describe
 * what is already live in production.
 */
export type ReleaseNote = {
  /** YYYY-MM-DD (or YYYY-MM-DDb …), unique and increasing */
  id: string
  title: { th: string; en: string }
  items: { th: string; en: string }[]
}

export const RELEASES: ReleaseNote[] = [
  {
    id: "2026-11-09",
    title: { th: "อัปเดตใหม่ของเป๋าเป๋า", en: "What's new in PaoPao" },
    items: [
      { th: "ตรวจก่อนบันทึก: พิมพ์รายการใน LINE แล้วเป๋าเป๋าส่งการ์ดให้ตรวจ แก้ยอด เปลี่ยนหมวด หรือสลับรายรับ/รายจ่ายได้ก่อนแตะบันทึก", en: "Check before saving: entries typed in LINE come back as a card where you can fix the amount, category or income/expense, then tap save" },
      { th: "เป้าหมายผูกกับหมวดไหนก็ได้ เช่น เป้าปลดหนี้กับหมวด \"ชำระหนี้\" ความคืบหน้าอัปเดตเองทุกครั้งที่บันทึก", en: "Goals can follow any category, like a debt goal tracking \"Debt Payment\", and update by themselves" },
      { th: "เปิดและสลับหน้าเร็วขึ้นมาก ข้อมูลทุกหน้าโหลดมาพร้อมกันตั้งแต่ครั้งแรก", en: "Much faster pages: every page's data loads at once, so switching pages is instant" },
      { th: "ปลอดภัยขึ้น: หมายเหตุรายการและแชท AI ถูกเข้ารหัสอีกชั้น และแชทที่ไม่ได้ใช้เกิน 90 วันจะถูกลบอัตโนมัติ", en: "More private: transaction notes and AI chats are encrypted, and chats unused for 90 days are deleted automatically" },
    ],
  },
]

/**
 * The releases to show: those newer than the last one the user dismissed. Accounts that never
 * dismissed one see only releases published after they signed up (a new user has nothing new).
 */
export function unseenReleases(lastSeen: string | null, userCreatedAt: Date, releases: ReleaseNote[] = RELEASES) {
  if (lastSeen) return releases.filter(r => r.id > lastSeen).slice(0, 3)
  // A release counts from the start of its Bangkok day; accounts created after that have nothing new
  const signedUp = userCreatedAt.getTime()
  return releases.filter(r => new Date(`${r.id.slice(0, 10)}T00:00:00+07:00`).getTime() > signedUp).slice(0, 3)
}
