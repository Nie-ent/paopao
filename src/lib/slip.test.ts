import { describe, expect, it } from 'vitest'
import { hashImage, normalizeReference } from './slip'

describe('normalizeReference', () => {
  it('strips labels, spaces and dashes so the same reference always compares equal', () => {
    expect(normalizeReference('Ref: 0160 6209 2532')).toBe('016062092532')
    expect(normalizeReference('เลขที่รายการ: 2026100412-ABCD')).toBe('2026100412ABCD')
    expect(normalizeReference('016062092532bpm08728')).toBe('016062092532BPM08728')
  })

  it('ignores missing or short values that could collide', () => {
    expect(normalizeReference('')).toBeNull()
    expect(normalizeReference(undefined)).toBeNull()
    expect(normalizeReference('1234')).toBeNull()
  })
})

describe('hashImage', () => {
  it('is stable for identical bytes and differs otherwise', () => {
    expect(hashImage(Buffer.from('slip'))).toBe(hashImage(Buffer.from('slip')))
    expect(hashImage(Buffer.from('slip'))).not.toBe(hashImage(Buffer.from('slip2')))
  })
})
