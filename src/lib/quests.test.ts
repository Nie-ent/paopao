import { describe, expect, it } from 'vitest'
import { questText } from './quests'

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
