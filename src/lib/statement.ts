import { BKK_OFFSET_MS } from "@/lib/dates"
import { normalizeReference } from "@/lib/slip"

export type StatementRow = {
  /** YYYY-MM-DD, Gregorian, Bangkok calendar day */
  date: string
  /** HH:mm in Bangkok time, when the statement shows it */
  time?: string
  type: "INCOME" | "EXPENSE"
  amount: number
  category: string
  note: string
  reference?: string | null
}

export type ExistingTransaction = { id: string; type: string; amount: number; date: Date; note: string | null; reference: string | null }

export type StatementPreviewRow = StatementRow & {
  /** Set when the row looks like a transaction that is already recorded */
  duplicateOf?: { id: string; date: string; amount: number; note: string | null; reason: "reference" | "amount-date" }
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Normalizes a date the AI read from a statement. Thai statements often use Buddhist-era years
 * (2569 = 2026); anything that isn't a valid date returns null so the row can be dropped.
 */
export function normalizeStatementDate(raw: string): string | null {
  const match = raw.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!match) return null
  let year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year > 2400) year -= 543
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/** The moment to store for a statement row: its time if known, otherwise midday Bangkok (never shifts the day). */
export function statementRowTimestamp(row: Pick<StatementRow, "date" | "time">) {
  const [y, m, d] = row.date.split("-").map(Number)
  const time = row.time?.match(/^(\d{1,2}):(\d{2})/)
  const [hours, minutes] = time ? [Number(time[1]), Number(time[2])] : [12, 0]
  return new Date(Date.UTC(y, m - 1, d, hours, minutes) - BKK_OFFSET_MS)
}

/**
 * Finds an already-recorded transaction that a statement row most likely duplicates:
 * the same bank reference, or the same type and amount within one day (slip times and
 * statement posting dates can differ around midnight). Each existing transaction is
 * matched at most once, so two genuine identical payments in the statement are not both hidden.
 */
export function markDuplicates(rows: StatementRow[], existing: ExistingTransaction[]): StatementPreviewRow[] {
  const used = new Set<string>()
  return rows.map(row => {
    const ref = normalizeReference(row.reference)
    const at = statementRowTimestamp(row).getTime()

    const byRef = ref ? existing.find(t => !used.has(t.id) && t.reference === ref) : undefined
    const byAmount = byRef ? undefined : existing.find(t =>
      !used.has(t.id) &&
      t.type === row.type &&
      Math.abs(t.amount - row.amount) < 0.005 &&
      Math.abs(t.date.getTime() - at) <= DAY_MS
    )
    const match = byRef ?? byAmount
    if (!match) return row

    used.add(match.id)
    return {
      ...row,
      duplicateOf: {
        id: match.id,
        date: match.date.toISOString(),
        amount: match.amount,
        note: match.note,
        reason: byRef ? "reference" : "amount-date",
      },
    }
  })
}

/** PDFs protected with an open password carry an /Encrypt entry in their trailer. */
export function isEncryptedPdf(bytes: Uint8Array) {
  const text = Buffer.from(bytes).toString("latin1")
  return text.includes("/Encrypt")
}
