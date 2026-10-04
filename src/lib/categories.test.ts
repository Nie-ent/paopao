import { describe, expect, it } from 'vitest'
import { CATEGORIES, CATEGORY_NAMES, EXPENSE_CATEGORIES, FALLBACK_CATEGORY, INCOME_CATEGORIES } from './categories'
import { en, th } from '@/i18n/messages'

describe('categories', () => {
  it('has unique names split cleanly into income and expense', () => {
    expect(new Set(CATEGORY_NAMES).size).toBe(CATEGORY_NAMES.length)
    expect([...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES].sort()).toEqual([...CATEGORY_NAMES].sort())
  })

  it('fallback categories exist with the right type', () => {
    for (const [type, name] of Object.entries(FALLBACK_CATEGORY)) {
      expect(CATEGORIES.find(c => c.name === name)?.type).toBe(type)
    }
  })

  it('every category has a display name in both languages', () => {
    for (const name of CATEGORY_NAMES) {
      const key = `category.${name}` as keyof typeof en
      expect(en[key], `en ${key}`).toBeTruthy()
      expect(th[key], `th ${key}`).toBeTruthy()
    }
  })

  it('every category tells the AI when to use it', () => {
    for (const c of CATEGORIES) expect(c.aiHint.length, c.name).toBeGreaterThan(10)
  })
})

describe('i18n', () => {
  it('Thai and English define the same keys with matching placeholders', () => {
    expect(Object.keys(th).sort()).toEqual(Object.keys(en).sort())
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      const vars = (s: string) => (s.match(/\{\w+\}/g) || []).sort()
      expect(vars(th[key]), key).toEqual(vars(en[key]))
    }
  })
})
