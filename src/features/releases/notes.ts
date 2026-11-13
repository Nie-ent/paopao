/**
 * "What's new" release notes, newest first. Signed-in users see the releases published since they
 * last dismissed the dialog (User.lastSeenRelease). To announce an update, add an entry at the
 * top with a new id (the date, plus a letter for a second release that day) and only describe
 * what is already live in production.
 */
export type ReleaseNote = {
  /** YYYY-MM-DD (or YYYY-MM-DDb …), unique and increasing */
  id: string
  /** Semantic version of the app this release shipped as (package.json "version"), e.g. "1.0.0" */
  version?: string
  title: { th: string; en: string }
  items: { th: string; en: string }[]
}

export const RELEASES: ReleaseNote[] = [
  {
    id: "2026-11-13",
    version: "1.0.0",
    title: { th: "เป๋าเป๋า 1.0: แยกบิลและทวงเงินในกลุ่ม LINE", en: "PaoPao 1.0: split bills and chase debts in LINE groups" },
    items: [
      { th: "เชิญเป๋าเป๋าเข้ากลุ่ม LINE แล้วพิมพ์ \"แยกบิล\" กดถ่ายรูปหรือเลือกรูปใบเสร็จได้จากการ์ดเลย เป๋าเป๋าอ่านรายการให้ ไม่มีใบเสร็จพิมพ์ \"แยกบิล 1200 ค่าห้อง\" เพื่อหารเท่ากัน", en: "Invite PaoPao to a LINE group and type \"แยกบิล\": take or pick a photo of the receipt right from the card and PaoPao reads the items. No receipt? Type \"แยกบิล 1200 rent\" to split evenly" },
      { th: "ทุกคนติ๊กรายการของตัวเอง รายการที่มีหลายชิ้น (เช่น ซูชิ 19 จาน) เลือกจำนวนของตัวเองได้ และเห็นยอดที่แต่ละคนต้องจ่ายทันที", en: "Everyone ticks what they had, picks how many of a multi-piece item (like 19 sushi plates) were theirs, and sees what each person owes right away" },
      { th: "ยอดรวมตรงกับใบเสร็จเสมอ ทั้ง VAT, service charge, ส่วนลดทั้งบิล และส่วนลดเฉพาะรายการ", en: "Totals always match the receipt, including VAT, service charge, whole-bill and per-item discounts" },
      { th: "ทวงเงินในกลุ่มได้: โอนแล้วส่งสลิปในกลุ่ม ยอดตรงปิดให้อัตโนมัติ จ่ายเงินสดกด \"จ่ายแล้ว\" ให้เจ้าของเงินยืนยัน กด \"ทวงทุกคน\" เพื่อแท็กคนที่ยังไม่จ่าย และสมาชิก Pro ได้สรุปยอดค้างทุกวันจันทร์", en: "Chase debts in the group: send the transfer slip and an exact amount is settled automatically, tap \"paid\" for cash, tag everyone who still owes, and Pro members get a Monday summary" },
    ],
  },
  {
    id: "2026-11-09d",
    title: { th: "รู้ว่าเงินรั่วตรงไหน: ค่าใช้จ่ายคงที่", en: "See where money leaks: fixed costs" },
    items: [
      { th: "หน้า \"ค่าใช้จ่ายคงที่\" รวมทุกอย่างที่จ่ายทุกเดือน บอกว่ากินรายรับไปกี่เปอร์เซ็นต์ และเหลือเงินใช้ได้เท่าไหร่ ใช้ได้ทุกแพ็กเกจ", en: "The new \"Fixed costs\" page adds up everything you pay each month, shows how much of your income it takes and what's left. On every plan" },
      { th: "ติดป้ายแต่ละรายการว่า \"จำเป็น\" หรือ \"ตัดได้\" เพื่อดูว่าถ้าตัดแล้วจะเหลือเงินเพิ่มเท่าไหร่", en: "Mark each one \"essential\" or \"could cut\" to see how much cutting would free up" },
      { th: "เป๋าเป๋าหารายการที่คุณจ่ายทุกเดือนแต่ยังไม่ได้ใส่ เช่น ค่าสมาชิกที่ลืมยกเลิก แตะเดียวก็เพิ่มได้", en: "PaoPao finds payments you make every month but haven't listed, like forgotten subscriptions, and adds them in one tap" },
      { th: "แชท AI (Pro) และคำแนะนำบนแดชบอร์ดรู้ค่าใช้จ่ายคงที่และเงินเหลือใช้ของคุณแล้ว จึงวางแผนได้ตรงกับตัวเลขจริง", en: "The AI chat (Pro) and dashboard tips now know your fixed costs and spare cash, so their plans fit your real numbers" },
    ],
  },
  {
    id: "2026-11-09c",
    title: { th: "อ่านอัปเดตย้อนหลังได้ และแชท AI สำหรับ Pro", en: "Read past updates, and AI chat for Pro" },
    items: [
      { th: "อ่านอัปเดตทั้งหมดย้อนหลังได้ทุกเมื่อที่ไอคอน 🔔 ด้านบน (มีจุดสีส้มเมื่อมีอัปเดตที่ยังไม่ได้อ่าน)", en: "Read every update again any time from the 🔔 bell at the top (it shows a dot when there's something new)" },
      { th: "แชทปรึกษาการเงินกับ AI เป็นฟีเจอร์ของแพ็กเกจ Pro (300 ข้อความ/เดือน) ส่วนแพ็กเกจ Free ยังได้คำแนะนำการเงินจาก AI บนแดชบอร์ด และทดลอง Pro ฟรีได้", en: "The AI money chat is now part of Pro (300 messages a month). Free still gets AI money tips on the dashboard, and you can try Pro free" },
    ],
  },
  {
    id: "2026-11-09b",
    title: { th: "ชวนเพื่อน รับ Pro ฟรี และอื่นๆ", en: "Invite friends for free Pro, and more" },
    items: [
      { th: "ชวนเพื่อน รับ Pro ฟรี: เพื่อนที่สมัครผ่านลิงก์ของคุณได้ทดลอง Pro 30 วัน และเมื่อเพื่อนจดครบ 3 วัน คุณได้ Pro ฟรี 30 วัน (สูงสุด 3 คน) ดูลิงก์ได้ที่หน้าแพ็กเกจ", en: "Invite friends, get Pro free: friends who join through your link get a 30-day Pro trial, and once they've logged on 3 days you get 30 days of Pro (up to 3 friends). Your link is on the plans page" },
      { th: "เลือกได้ว่าจะรับสรุปการเงินทาง LINE แบบรายสัปดาห์ (ทุกวันจันทร์) ทุกเช้า หรือปิด ได้ที่หน้าตั้งค่า", en: "Choose your LINE money summary in Settings: weekly (Mondays), every morning, or off" },
      { th: "ภารกิจที่รับแต้มแล้วจะหายไปจากหน้าแรก ไม่ค้างการ์ดไว้", en: "Quests you've claimed now disappear from the dashboard" },
      { th: "แชทกับ AI นับเป็นรายเดือน: Free 30 ข้อความ, Pro 300 ข้อความ และนำเข้า Statement ได้ 20 ครั้งต่อเดือน", en: "AI chat now has a monthly allowance (Free 30, Pro 300 messages), and statement imports are 20 a month" },
    ],
  },
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
