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
