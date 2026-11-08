import { describe, expect, it } from 'vitest'
import { bangkokDate, bangkokDayKey, bangkokMonthRange, bangkokParts, dayWithTimeOf, parseBangkokDateTime, startOfBangkokDay, toBangkokDateTimeInput } from './dates'

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

describe('Bangkok calendar helpers', () => {
  it('puts 01:00 Bangkok on 1 Dec in December, although it is still November in UTC', () => {
    const instant = new Date('2026-11-30T18:00:00Z')
    expect(bangkokParts(instant)).toEqual({ year: 2026, month: 11, day: 1 })
    expect(bangkokDayKey(instant)).toBe('2026-12-01')
    const { gte, lt } = bangkokMonthRange(2026, 11)
    expect(instant >= gte && instant < lt).toBe(true)
  })

  it('month range runs from Bangkok midnight to the next month, rolling over the year', () => {
    const { gte, lt } = bangkokMonthRange(2026, 11)
    expect(gte.toISOString()).toBe('2026-11-30T17:00:00.000Z')
    expect(lt.toISOString()).toBe('2026-12-31T17:00:00.000Z')
  })

  it('bangkokDate matches startOfBangkokDay', () => {
    const now = new Date('2026-10-03T23:00:00Z')
    const { year, month, day } = bangkokParts(now)
    expect(bangkokDate(year, month, day).getTime()).toBe(startOfBangkokDay(now).getTime())
  })
})

describe('parseBangkokDateTime', () => {
  it('reads a datetime-local value as Bangkok time', () => {
    expect(parseBangkokDateTime('2026-11-08T18:00')?.toISOString()).toBe('2026-11-08T11:00:00.000Z')
  })
  it('reads a date as Bangkok midnight', () => {
    expect(parseBangkokDateTime('2026-12-31')?.toISOString()).toBe('2026-12-30T17:00:00.000Z')
  })
  it('rejects anything else', () => {
    expect(parseBangkokDateTime('')).toBeNull()
    expect(parseBangkokDateTime('tomorrow')).toBeNull()
  })
  it('round-trips with toBangkokDateTimeInput', () => {
    expect(toBangkokDateTimeInput(parseBangkokDateTime('2026-11-08T18:00')!)).toBe('2026-11-08T18:00')
  })
})
