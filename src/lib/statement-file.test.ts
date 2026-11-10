import { describe, expect, it } from 'vitest'
import { STATEMENT_ACCEPT, statementAccept, statementFileKind, statementImageMime } from './statement-file'

describe('statementFileKind', () => {
  it('recognises files by MIME type', () => {
    expect(statementFileKind('statement', 'application/pdf')).toBe('pdf')
    expect(statementFileKind('x', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe('sheet')
    expect(statementFileKind('x', 'text/csv')).toBe('sheet')
    expect(statementFileKind('x', 'image/png')).toBe('image')
  })

  it('falls back to the extension when Android sends no or a generic type', () => {
    expect(statementFileKind('KBank_Statement.PDF', '')).toBe('pdf')
    expect(statementFileKind('scb.xlsx', 'application/octet-stream')).toBe('sheet')
    expect(statementFileKind('Screenshot_2026.jpg', '')).toBe('image')
  })

  it('rejects other files', () => {
    expect(statementFileKind('notes.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBeNull()
    expect(statementFileKind('file', '')).toBeNull()
  })
})

describe('statementImageMime', () => {
  it('uses the type, or the extension when the type is missing', () => {
    expect(statementImageMime('a.png', 'image/png')).toBe('image/png')
    expect(statementImageMime('a.JPG', '')).toBe('image/jpeg')
    expect(statementImageMime('a.pdf', '')).toBeNull()
  })
})

describe('statementAccept', () => {
  it('has no filter on Android, so the picker shows documents and not only photos', () => {
    expect(statementAccept('Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 Line/14.19.1')).toBeUndefined()
  })

  it('filters elsewhere', () => {
    expect(statementAccept('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Line/14.19.0')).toBe(STATEMENT_ACCEPT)
  })
})
