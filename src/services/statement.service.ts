import * as XLSX from "xlsx"
import { extractText, getDocumentProxy } from "unpdf"
import prisma from "@/lib/db"
import { chunkStatementText, extractStatementRows, type RawStatementRow, type StatementInput } from "@/services/ai.service"
import { statementFileKind, statementImageMime } from "@/lib/statement-file"
import { isEncryptedPdf, markDuplicates, normalizeStatementDate, statementRowTimestamp, type StatementPreviewRow, type StatementRow } from "@/lib/statement"
import { normalizeReference } from "@/lib/slip"
import { isValidAmount } from "@/lib/money"

export const MAX_STATEMENT_BYTES = 4 * 1024 * 1024 // Vercel caps request bodies at 4.5 MB

export class StatementError extends Error {
  constructor(public code: "TOO_LARGE" | "UNSUPPORTED" | "PASSWORD_REQUIRED" | "WRONG_PASSWORD" | "NO_ROWS") {
    super(code)
  }
}

/** Turns an uploaded statement (PDF, CSV/Excel or screenshot) into what the AI should read. */
async function toStatementInput(file: File, password: string | undefined): Promise<StatementInput> {
  const bytes = Buffer.from(await file.arrayBuffer())
  const kind = statementFileKind(file.name, file.type)

  if (kind === "pdf") {
    // Read the text layer here (decrypting protected PDFs), so long statements can be read in
    // chunks; only a scanned PDF with no text goes to the AI as a file
    const encrypted = isEncryptedPdf(bytes)
    if (encrypted && !password) throw new StatementError("PASSWORD_REQUIRED")
    try {
      const pdf = await getDocumentProxy(new Uint8Array(bytes), encrypted ? { password } : {})
      const { text } = await extractText(pdf, { mergePages: false })
      const joined = (text as string[]).join("\n")
      if (joined.replace(/\s+/g, "").length >= 40) return { kind: "text", text: joined }
      if (encrypted) throw new StatementError("NO_ROWS")
      return { kind: "file", data: bytes, mimeType: "application/pdf" }
    } catch (error) {
      if ((error as { name?: string })?.name === "PasswordException") throw new StatementError("WRONG_PASSWORD")
      throw error
    }
  }

  if (kind === "sheet") {
    const workbook = XLSX.read(bytes, { type: "buffer", cellDates: true })
    // Real date cells are written as ISO dates; the default m/d/yy is ambiguous for Thai d/m statements
    const text = workbook.SheetNames.map(sheet => XLSX.utils.sheet_to_csv(workbook.Sheets[sheet], { blankrows: false, dateNF: "yyyy-mm-dd" })).join("\n")
    return { kind: "text", text }
  }

  const imageMime = kind === "image" ? statementImageMime(file.name, file.type) : null
  if (imageMime) return { kind: "file", data: bytes, mimeType: imageMime }

  throw new StatementError("UNSUPPORTED")
}

/** The user's own category names, which the AI may also use. */
export async function userCategoryNames(userId: string) {
  return (await prisma.category.findMany({ where: { userId }, select: { name: true } })).map(c => c.name)
}

/**
 * First step of an import: reads the file (no AI). Text statements come back as chunks for the
 * AI to read one request at a time; images and scanned PDFs are read here in one AI call.
 */
export async function prepareStatement(userId: string, file: File, password?: string): Promise<{ chunks: string[] } | { rows: StatementPreviewRow[] }> {
  if (file.size > MAX_STATEMENT_BYTES) throw new StatementError("TOO_LARGE")
  const input = await toStatementInput(file, password)
  if (input.kind === "text") {
    const chunks = chunkStatementText(input.text)
    if (chunks.length === 0) throw new StatementError("NO_ROWS")
    return { chunks }
  }
  return { rows: await finalizeStatement(userId, await extractStatementRows(input, await userCategoryNames(userId))) }
}

/** Reads a statement in one request and flags rows that look like transactions the user already recorded. */
export async function previewStatement(userId: string, file: File, password?: string): Promise<StatementPreviewRow[]> {
  if (file.size > MAX_STATEMENT_BYTES) throw new StatementError("TOO_LARGE")

  // Read the file first so a bad file or password fails before any database or AI work
  const input = await toStatementInput(file, password)
  const raw = await extractStatementRows(input, await userCategoryNames(userId))
  return finalizeStatement(userId, raw)
}

/** Last step: cleans the AI's rows and flags likely duplicates of what the user already recorded. */
export async function finalizeStatement(userId: string, raw: RawStatementRow[]): Promise<StatementPreviewRow[]> {

  const rows: StatementRow[] = raw.flatMap(r => {
    const date = normalizeStatementDate(r.date)
    const amount = Math.abs(Number(r.amount))
    if (!date || !isValidAmount(amount)) return []
    return [{ date, time: r.time || undefined, type: r.type, amount, category: r.category, note: r.note?.trim() || "-", reference: normalizeReference(r.reference) }]
  })
  if (rows.length === 0) throw new StatementError("NO_ROWS")

  const times = rows.map(r => statementRowTimestamp(r).getTime())
  const DAY = 24 * 60 * 60 * 1000
  const existing = await prisma.transaction.findMany({
    where: { userId, date: { gte: new Date(Math.min(...times) - DAY), lte: new Date(Math.max(...times) + DAY) } },
    select: { id: true, type: true, amount: true, date: true, note: true, reference: true },
  })
  return markDuplicates(rows, existing)
}
