import { th } from "@/i18n/messages"

// Short saving tip per top expense category (keys match DB category names)
const CATEGORY_TIPS: Record<string, string> = {
  'Food': 'ลองทำอาหารหรือเตรียมข้าวกล่องเองสักมื้อ ช่วยประหยัดได้เยอะเลยครับ',
  'Groceries': 'จดรายการก่อนไปซื้อของ จะช่วยลดของที่ไม่จำเป็นได้ครับ',
  'Transport': 'ถ้าเป็นไปได้ ลองใช้ขนส่งสาธารณะหรือเดินทางร่วมกันดูนะครับ',
  'Shopping': 'ก่อนซื้อของชิ้นใหญ่ ลองรอ 24 ชั่วโมงแล้วค่อยตัดสินใจนะครับ',
  'Entertainment': 'ลองตั้งงบความบันเทิงต่อเดือนไว้ จะได้สนุกแบบไม่กระทบเงินเก็บครับ',
  'Utilities': 'ปิดไฟและเครื่องใช้ไฟฟ้าที่ไม่ใช้ ช่วยลดค่าไฟได้ครับ',
  'Housing': 'ค่าที่อยู่เป็นรายจ่ายก้อนใหญ่ ลองตั้งไว้ไม่เกิน 30% ของรายได้นะครับ',
  'Personal Care': 'ลองเปรียบเทียบราคาหรือรอช่วงโปรโมชันก่อนซื้อครับ',
  'Health & Medical': 'สุขภาพสำคัญที่สุด ลองเช็กสิทธิ์ประกันหรือสวัสดิการที่มีอยู่ด้วยนะครับ',
  'Debt Payment': 'เยี่ยมเลยที่จ่ายหนี้ ลองโปะก้อนที่ดอกเบี้ยสูงที่สุดก่อนนะครับ',
}
const DEFAULT_TIP = 'ลองตั้งงบรายวันไว้ จะช่วยคุมรายจ่ายได้ง่ายขึ้นครับ'

type DigestTx = { type: string; amount: number; category: { name: string } | null }

export function buildMorningBrief(transactions: DigestTx[]) {
  const baht = (n: number) => `฿${Math.round(n).toLocaleString('en-US')}`
  const expenses = transactions.filter(t => t.type === 'EXPENSE')
  const totalSpent = expenses.reduce((sum, t) => sum + t.amount, 0)
  const totalIncome = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0)
  const lines = ['🌅 สวัสดีตอนเช้า สรุปยอดเงินเมื่อวานมาแล้ว!']

  if (totalSpent === 0) {
    lines.push(totalIncome > 0
      ? `💰 เมื่อวานมีรายรับ ${baht(totalIncome)} และไม่มีรายจ่ายเลย เป็นวันที่เหมาะกับการเก็บเงินสุดๆ`
      : '🎉 เมื่อวานไม่มียอดใช้จ่ายเลย เก่งมากครับ')
    lines.push('✨ รักษาโมเมนตัมนี้ไว้ แล้วเงินเก็บจะโตขึ้นเรื่อยๆ ครับ')
    return lines.join('\n')
  }

  const byCategory: Record<string, number> = {}
  for (const t of expenses) {
    const name = t.category?.name || 'Other Expense'
    byCategory[name] = (byCategory[name] || 0) + t.amount
  }
  const [topCategory] = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]
  const topLabel = (th as Record<string, string>)[`category.${topCategory}`] || topCategory

  lines.push(`💸 ใช้ไป ${baht(totalSpent)}${totalIncome > 0 ? ` | รับเข้า ${baht(totalIncome)}` : ''} (จ่ายมากสุด: ${topLabel})`)
  lines.push(`💡 ${CATEGORY_TIPS[topCategory] || DEFAULT_TIP}`)
  return lines.join('\n')
}
