import { describe, expect, it } from 'vitest'
import { dayWithTimeOf, startOfBangkokDay } from './dates'

describe('startOfBangkokDay', () => {
  it('returns Bangkok midnight as a UTC instant', () => {
    // 10:00 Bangkok on 4 Oct
    expect(startOfBangkokDay(new Date('2026-10-04T03:00:00Z')).toISOString()).toBe('2026-10-03T17:00:00.000Z')
  })

  it('uses the Bangkok date before 07:00 Bangkok (still the previous day in UTC)', () => {
    // 06:00 Bangkok on 4 Oct = 23:00 UTC on 3 Oct
    expect(startOfBangkokDay(new Date('2026-10-03T23:00:00Z')).toISOString()).toBe('2026-10-03T17:00:00.000Z')
  })
})

describe('dayWithTimeOf', () => {
  it('keeps the time of day of the source on the chosen Bangkok day', () => {
    // Picked 1 Oct; now is 14:30 Bangkok on 4 Oct → 14:30 Bangkok on 1 Oct
    const result = dayWithTimeOf('2026-10-01', new Date('2026-10-04T07:30:00Z'))
    expect(result.toISOString()).toBe('2026-10-01T07:30:00.000Z')
  })

  it('does not jump to the next day early in the Bangkok morning', () => {
    // Picked 4 Oct at 06:00 Bangkok (23:00 UTC the day before)
    const result = dayWithTimeOf('2026-10-04', new Date('2026-10-03T23:00:00Z'))
    expect(result.toISOString()).toBe('2026-10-03T23:00:00.000Z')
  })

  it('keeps an existing entry on the same moment when its day is unchanged', () => {
    const existing = new Date('2026-09-15T12:34:56.789Z')
    expect(dayWithTimeOf('2026-09-15', existing).getTime()).toBe(existing.getTime())
  })
})
