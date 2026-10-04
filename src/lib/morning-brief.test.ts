import { describe, expect, it } from 'vitest'
import { buildMorningBrief } from './morning-brief'

const tx = (type: 'INCOME' | 'EXPENSE', amount: number, category: string) => ({ type, amount, category: { name: category } })

describe('buildMorningBrief', () => {
  it('summarises spending with the top category in Thai and a matching tip', () => {
    const brief = buildMorningBrief([tx('EXPENSE', 65, 'Food'), tx('EXPENSE', 44, 'Transport'), tx('EXPENSE', 120, 'Food'), tx('INCOME', 500, 'Freelance')])
    expect(brief).toContain('ใช้ไป ฿229')
    expect(brief).toContain('รับเข้า ฿500')
    expect(brief).toContain('จ่ายมากสุด: อาหาร')
    expect(brief).toContain('ข้าวกล่อง')
  })

  it('congratulates a day with no spending', () => {
    expect(buildMorningBrief([])).toContain('ไม่มียอดใช้จ่ายเลย')
    expect(buildMorningBrief([tx('INCOME', 30000, 'Salary')])).toContain('฿30,000')
  })

  it('shows custom category names as-is and falls back to the default tip', () => {
    const brief = buildMorningBrief([tx('EXPENSE', 300, 'ค่าเลี้ยงแมว')])
    expect(brief).toContain('จ่ายมากสุด: ค่าเลี้ยงแมว')
    expect(brief).toContain('ตั้งงบรายวัน')
  })

  it('never contains markdown (LINE shows it literally)', () => {
    expect(buildMorningBrief([tx('EXPENSE', 99, 'Shopping')])).not.toMatch(/\*\*/)
  })
})
