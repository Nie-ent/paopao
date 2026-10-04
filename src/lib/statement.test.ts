import { describe, expect, it } from 'vitest'
import { isEncryptedPdf, markDuplicates, normalizeStatementDate, statementRowTimestamp, type ExistingTransaction, type StatementRow } from './statement'

const row = (over: Partial<StatementRow> = {}): StatementRow => ({ date: '2026-10-02', type: 'EXPENSE', amount: 65, category: 'Food', note: 'กาแฟ', ...over })
const tx = (over: Partial<ExistingTransaction> = {}): ExistingTransaction => ({ id: 't1', type: 'EXPENSE', amount: 65, date: new Date('2026-10-02T03:00:00Z'), note: 'กาแฟ', reference: null, ...over })

describe('normalizeStatementDate', () => {
  it('keeps Gregorian dates and converts Buddhist-era years', () => {
    expect(normalizeStatementDate('2026-10-02')).toBe('2026-10-02')
    expect(normalizeStatementDate('2569-10-2')).toBe('2026-10-02')
  })

  it.each(['2026-02-30', '02/10/2026', '', 'yesterday'])('rejects "%s"', raw => {
    expect(normalizeStatementDate(raw)).toBeNull()
  })
})

describe('statementRowTimestamp', () => {
  it('uses the statement time in Bangkok', () => {
    expect(statementRowTimestamp({ date: '2026-10-02', time: '08:15' }).toISOString()).toBe('2026-10-02T01:15:00.000Z')
  })

  it('uses midday Bangkok when there is no time, so the day never shifts', () => {
    expect(statementRowTimestamp({ date: '2026-10-02' }).toISOString()).toBe('2026-10-02T05:00:00.000Z')
  })
})

describe('markDuplicates', () => {
  it('flags a row with the same bank reference', () => {
    const [r] = markDuplicates([row({ reference: 'ref 0160 6209 2532', amount: 999 })], [tx({ reference: '016062092532' })])
    expect(r.duplicateOf).toMatchObject({ id: 't1', reason: 'reference' })
  })

  it('flags the same type and amount within a day (slip vs statement posting date)', () => {
    const [r] = markDuplicates([row({ date: '2026-10-03', time: '00:30' })], [tx({ date: new Date('2026-10-02T16:50:00Z') })])
    expect(r.duplicateOf?.reason).toBe('amount-date')
  })

  it('does not flag different amounts, types or far-apart dates', () => {
    const rows = markDuplicates(
      [row({ amount: 66 }), row({ type: 'INCOME' }), row({ date: '2026-10-05' })],
      [tx()],
    )
    expect(rows.every(r => !r.duplicateOf)).toBe(true)
  })

  it('matches each existing transaction only once, so a genuine repeat payment stays importable', () => {
    const rows = markDuplicates([row(), row()], [tx()])
    expect(rows.filter(r => r.duplicateOf)).toHaveLength(1)
  })
})

describe('isEncryptedPdf', () => {
  it('detects the /Encrypt trailer entry', () => {
    expect(isEncryptedPdf(Buffer.from('%PDF-1.7\ntrailer << /Encrypt 5 0 R >>'))).toBe(true)
    expect(isEncryptedPdf(Buffer.from('%PDF-1.7\ntrailer << /Root 1 0 R >>'))).toBe(false)
  })
})
