import prisma from "@/lib/db"
import type { ExtractedTransaction } from "@/services/ai.service"

/**
 * Cheap, rule-based parsing for simple LINE messages like "กาแฟ 65" or "BTS 44 บาท",
 * so the common case never calls the LLM. Returns null whenever the message is not a
 * clear single item, and the caller falls back to AI.
 */

// Ordered: more specific categories first, because Thai substrings overlap
// (e.g. "อาหารแมว" is pets, "ค่าน้ำ" is a bill, "grabfood" is food not transport).
// Thai keywords match as substrings (Thai has no spaces between words), so avoid very short
// ones: "นม" would match "ค่าวินมอเตอร์ไซค์". English keywords match whole words only.
type Keyword = string | RegExp
const EXPENSE_KEYWORDS: [string, Keyword[]][] = [
  ['Family & Pets', ['อาหารแมว', 'อาหารหมา', 'แมว', 'หมา', 'สัตว์เลี้ยง', 'ให้แม่', 'ให้พ่อ', 'ส่งเงินให้', 'ค่าเทอมลูก']],
  ['Education', [/หนังสือ(?!พิมพ์)/, 'คอร์ส', 'course', 'udemy', 'ค่าเรียน', 'ค่าเทอม', 'ติวเตอร์']],
  ['Utilities', [/ค่าน้ำ(?!ตก|แข็ง|ปั่น|หวาน|มัน|ผลไม้|อัดลม)/, 'ค่าไฟ', /ค่าเน็ต(?!ฟลิก)/, 'ค่าโทร', 'ค่ามือถือ', 'internet', 'wifi', 'อินเทอร์เน็ต']],
  ['Housing', ['ค่าเช่า', 'ค่าห้อง', 'ค่าคอนโด', 'ค่าบ้าน', 'ค่าส่วนกลาง', 'rent']],
  ['Investment', ['ลงทุน', 'หุ้น', 'กองทุน', 'คริปโต', 'crypto', 'bitcoin', 'btc', 'dca']],
  ['Saving', ['ออมเงิน', 'เก็บเงิน', 'ฝากเงิน', 'เงินออม']],
  ['Debt Payment', ['ผ่อน', 'บัตรเครดิต', 'ใช้หนี้', 'จ่ายหนี้']],
  ['Gift & Donation', ['ทำบุญ', 'บริจาค', 'ซองงาน', 'ใส่ซอง', 'ของขวัญ']],
  ['Health & Medical', ['โรงพยาบาล', 'คลินิก', 'หาหมอ', 'ทำฟัน', 'ร้านยา', 'ค่ายา', 'คลังยา', 'ยาทา', 'ยาแก้', 'ยาดม', 'ฟิตเนส', 'gym']],
  ['Personal Care', ['ตัดผม', 'ทำผม', 'ทำเล็บ', 'สปา', 'นวด']],
  ['Groceries', ['lotus', 'โลตัส', 'big c', 'บิ๊กซี', 'tops', 'makro', 'แม็คโคร', 'ซุปเปอร์', 'ตลาด']],
  ['Food', ['grabfood', 'grab food', 'lineman', 'foodpanda', 'ข้าว', 'กาแฟ', 'ก๋วยเตี๋ยว', 'อาหาร', 'ขนม', 'ชาไทย', 'ชาเขียว', 'ชานม', 'นมสด', 'นมเปรี้ยว',
    'หมูกระทะ', 'ชาบู', 'ส้มตำ', 'ไก่ทอด', 'เบเกอรี่', 'pizza', 'coffee', 'latte', 'cafe', 'คาเฟ่', 'starbucks', 'มื้อ', 'lunch', 'dinner', 'breakfast']],
  ['Transport', ['bts', 'mrt', 'grab', 'bolt', 'taxi', 'แท็กซี่', 'วินมอไซค์', 'มอไซค์', 'มอเตอร์ไซ', 'รถเมล์', 'ค่ารถ', 'น้ำมัน', 'ทางด่วน', 'ค่าจอด', 'จอดรถ', 'รถไฟ']],
  ['Entertainment', ['netflix', 'เน็ตฟลิกซ์', 'spotify', 'youtube', 'disney', 'ดูหนัง', 'หนัง', 'cinema', 'คอนเสิร์ต', 'เกม', 'game']],
  ['Shopping', ['shopee', 'lazada', 'uniqlo', 'เสื้อ', 'รองเท้า', 'กางเกง', 'กระเป๋า', 'ช้อปปิ้ง']],
]

const INCOME_KEYWORDS: [string, Keyword[]][] = [
  ['Salary', ['เงินเดือน', 'salary', 'โบนัส', 'bonus']],
  ['Freelance', ['ฟรีแลนซ์', 'freelance', 'ค่าจ้าง', 'รับงาน']],
  ['Investment Income', ['ปันผล', 'dividend', 'ดอกเบี้ย']],
  ['Gift', ['อั่งเปา', 'ได้ของขวัญ']],
  ['Transfer In', ['เงินโอนเข้า']],
  ['Other Income', ['รายได้', 'ได้เงิน', 'รับเงิน', 'ขายของ']],
]

function keywordMatches(lower: string, keyword: Keyword) {
  if (keyword instanceof RegExp) return keyword.test(lower)
  if (/^[a-z0-9 ]+$/.test(keyword)) return new RegExp(`(^|[^a-z])${keyword}($|[^a-z])`).test(lower)
  return lower.includes(keyword)
}

function matchKeywords(text: string, table: [string, Keyword[]][]) {
  const lower = text.toLowerCase()
  for (const [category, keywords] of table) {
    if (keywords.some(k => keywordMatches(lower, k))) return category
  }
  return null
}

/** Pulls out the single amount and the description. Null when there isn't exactly one number. */
export function splitAmount(text: string): { amount: number; note: string } | null {
  const numbers = text.match(/\d[\d,]*(?:\.\d+)?/g)
  if (!numbers || numbers.length !== 1) return null

  const amount = Number(numbers[0].replace(/,/g, ''))
  if (!Number.isFinite(amount) || amount <= 0) return null

  const note = text
    .replace(numbers[0], ' ')
    .replace(/บาท|฿|thb|baht/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!note || note.length > 60) return null

  return { amount, note }
}

/** Keyword-only classification (no DB). Exported for tests. */
// Money moving back and forth between people ("พี่บอสคืนค่าข้าว", "ยืมเพื่อน") flips income vs
// expense in ways keywords can't tell, so leave those to the AI.
const AMBIGUOUS = /คืน|ยืม|ทอน|refund|repay/i

export function classifyByKeywords(note: string): { type: 'INCOME' | 'EXPENSE'; category: string } | null {
  if (AMBIGUOUS.test(note)) return null
  const income = matchKeywords(note, INCOME_KEYWORDS)
  if (income) return { type: 'INCOME', category: income }
  const expense = matchKeywords(note, EXPENSE_KEYWORDS)
  if (expense) return { type: 'EXPENSE', category: expense }
  return null
}

export async function quickParseTransaction(text: string, userId: string): Promise<ExtractedTransaction | null> {
  const split = splitAmount(text)
  if (!split) return null

  // The user's own history wins: the same note was categorized before (by AI or by hand)
  const previous = await prisma.transaction.findFirst({
    where: { userId, note: { equals: split.note, mode: 'insensitive' } },
    orderBy: { date: 'desc' },
    include: { category: true },
  })
  if (previous?.category) {
    return { type: previous.type, amount: split.amount, category: previous.category.name, note: split.note }
  }

  const byKeyword = classifyByKeywords(split.note)
  if (!byKeyword) return null
  return { ...byKeyword, amount: split.amount, note: split.note }
}
