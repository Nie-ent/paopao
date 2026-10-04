import { describe, expect, it } from 'vitest'
import { classifyByKeywords, splitAmount } from './quick-parse'

const parse = (text: string) => {
  const split = splitAmount(text)
  if (!split) return 'NOT_SIMPLE'
  const classified = classifyByKeywords(split.note)
  return classified ? { ...classified, ...split } : 'NO_KEYWORD'
}

describe('splitAmount', () => {
  it('extracts one amount and the description', () => {
    expect(splitAmount('กาแฟ 65')).toEqual({ amount: 65, note: 'กาแฟ' })
    expect(splitAmount('BTS 44 บาท')).toEqual({ amount: 44, note: 'BTS' })
    expect(splitAmount('ค่าไฟ 1,250.50')).toEqual({ amount: 1250.5, note: 'ค่าไฟ' })
  })

  it.each([
    'ข้าวมันไก่ 50 ชาไทย 35', // two items
    'ข้าว 2 จาน 100', // two numbers
    '7-11 89', // digits in the name
    'สวัสดีครับ', // no number
    '0',
  ])('leaves "%s" to the AI', text => {
    expect(splitAmount(text)).toBeNull()
  })
})

describe('classifyByKeywords', () => {
  it.each([
    ['กาแฟ 65', 'EXPENSE', 'Food'],
    ['grabfood 189', 'EXPENSE', 'Food'],
    ['grab 120', 'EXPENSE', 'Transport'],
    ['ค่าจอดรถ IMPACT 40', 'EXPENSE', 'Transport'],
    ['เงินเดือนเข้า 30,000', 'INCOME', 'Salary'],
    ['ค่าน้ำ 150', 'EXPENSE', 'Utilities'],
    ['อาหารแมว 350', 'EXPENSE', 'Family & Pets'],
    // Regressions found against real history
    ['ค่าวินมอเตอร์ไซด์ 30', 'EXPENSE', 'Transport'], // contains "นม"
    ['ค่าเน็ตฟลิกซ์ 419', 'EXPENSE', 'Entertainment'], // contains "ค่าเน็ต"
    ['คลังยาตลาดพลู 120', 'EXPENSE', 'Health & Medical'], // contains "ตลาด"
  ])('"%s" → %s / %s', (text, type, category) => {
    expect(parse(text)).toMatchObject({ type, category })
  })

  it.each([
    'ค่าน้ำตกหมู 60', // food, not a water bill
    'ค่าน้ำแข็ง 20',
    'laptops 25000', // "tops" must match whole words only
    'โอนให้เพื่อน 500',
    'พี่บอสคืนค่าข้าว 100', // a refund is income, keywords would say food expense
    'ยืมเพื่อนกินข้าว 200',
  ])('sends "%s" to the AI', text => {
    expect(parse(text)).toBe('NO_KEYWORD')
  })
})
