/**
 * Money in PaoPao: baht amounts are stored as Decimal(12, 2) in the database, so stored values,
 * SQL sums and comparisons are exact to the satang. The app works with plain numbers (server
 * actions can't send Decimal objects to the browser), converted once in src/lib/db.ts (decimalsToNumbers, src/lib/money-db.ts), and
 * totals added up in JavaScript are rounded with roundMoney.
 */
/** The largest amount accepted anywhere (forms, LINE, slips, statements, goals); the column holds up to 9,999,999,999.99. */
export const MAX_AMOUNT = 100_000_000

/** A positive, finite amount no larger than MAX_AMOUNT. */
export function isValidAmount(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0 && n <= MAX_AMOUNT
}

/** Rounds to the satang, so float sums like 0.1 + 0.2 come out as 0.3. */
export function roundMoney(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Adds amounts and rounds the total to the satang. */
export function sumMoney(values: Iterable<number>) {
  let total = 0
  for (const v of values) total += v
  return roundMoney(total)
}
