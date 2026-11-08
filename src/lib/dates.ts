// The app's users are in Thailand; "today" and calendar days are Bangkok time (UTC+7, no DST).
export const BKK_OFFSET_MS = 7 * 60 * 60 * 1000

/** Start of the Bangkok calendar day containing `now`, as a UTC instant. */
export function startOfBangkokDay(now = new Date()) {
  const bkk = new Date(now.getTime() + BKK_OFFSET_MS)
  return new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate()) - BKK_OFFSET_MS)
}

/**
 * Combines a Bangkok calendar day (YYYY-MM-DD, as sent by a date input) with the time of day of
 * `timeSource`, so entries saved from a date picker sort alongside entries with real timestamps.
 */
export function dayWithTimeOf(dateStr: string, timeSource: Date) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const msIntoDay = timeSource.getTime() - startOfBangkokDay(timeSource).getTime()
  return new Date(Date.UTC(y, m - 1, d) - BKK_OFFSET_MS + msIntoDay)
}

/** Bangkok calendar date of an instant. `month` is 0-based like Date#getMonth. */
export function bangkokParts(date: Date) {
  const bkk = new Date(date.getTime() + BKK_OFFSET_MS)
  return { year: bkk.getUTCFullYear(), month: bkk.getUTCMonth(), day: bkk.getUTCDate() }
}

/** Bangkok midnight of a calendar day, as a UTC instant. Month is 0-based; overflow rolls over like Date.UTC. */
export function bangkokDate(year: number, month: number, day = 1) {
  return new Date(Date.UTC(year, month, day) - BKK_OFFSET_MS)
}

/** Start (inclusive) and end (exclusive) of a Bangkok calendar month. */
export function bangkokMonthRange(year: number, month: number) {
  return { gte: bangkokDate(year, month, 1), lt: bangkokDate(year, month + 1, 1) }
}

/** "YYYY-MM-DD" of the Bangkok calendar day an instant falls on, for same-day comparisons. */
export function bangkokDayKey(date: Date) {
  const { year, month, day } = bangkokParts(date)
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/**
 * Parses a date input ("YYYY-MM-DD") or datetime-local input ("YYYY-MM-DDTHH:mm") as Bangkok time.
 * `new Date(str)` would read it in the server's timezone, which is UTC on Vercel.
 */
export function parseBangkokDateTime(value: string | null | undefined) {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/)
  if (!m) return null
  const [, y, mo, d, h = "0", mi = "0"] = m
  return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi) - BKK_OFFSET_MS)
}

/** The value a datetime-local input needs to show an instant in Bangkok time. */
export function toBangkokDateTimeInput(date: Date) {
  return new Date(date.getTime() + BKK_OFFSET_MS).toISOString().slice(0, 16)
}
