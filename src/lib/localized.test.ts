import { describe, expect, it } from 'vitest'
import { questText, rewardText } from './localized'

const quest = { title: 'เข้าสู่ระบบครั้งแรก', description: 'รางวัลต้อนรับสมาชิกใหม่', titleEn: 'First sign-in', descriptionEn: 'A welcome reward for new members' }

describe('questText', () => {
  it('shows English copy in the English UI', () => {
    expect(questText(quest, 'en')).toEqual({ title: 'First sign-in', description: 'A welcome reward for new members' })
  })

  it('shows Thai copy in the Thai UI', () => {
    expect(questText(quest, 'th')).toEqual({ title: 'เข้าสู่ระบบครั้งแรก', description: 'รางวัลต้อนรับสมาชิกใหม่' })
  })

  it('falls back to Thai when a translation is missing or blank', () => {
    expect(questText({ ...quest, titleEn: null, descriptionEn: '  ' }, 'en')).toEqual({ title: 'เข้าสู่ระบบครั้งแรก', description: 'รางวัลต้อนรับสมาชิกใหม่' })
  })
})

describe('rewardText', () => {
  const reward = { name: 'สติ๊กเกอร์ไลน์น้อง Paopao', description: 'สติ๊กเกอร์ไลน์น้อง Paopao', nameEn: 'PaoPao LINE stickers', descriptionEn: 'A PaoPao LINE sticker set' }

  it('uses the English copy in the English UI', () => {
    expect(rewardText(reward, 'en')).toEqual({ name: 'PaoPao LINE stickers', description: 'A PaoPao LINE sticker set' })
  })

  it('keeps Thai in the Thai UI and when no translation was entered', () => {
    expect(rewardText(reward, 'th').name).toBe('สติ๊กเกอร์ไลน์น้อง Paopao')
    expect(rewardText({ ...reward, nameEn: '', descriptionEn: null }, 'en')).toEqual({ name: 'สติ๊กเกอร์ไลน์น้อง Paopao', description: 'สติ๊กเกอร์ไลน์น้อง Paopao' })
  })
})
