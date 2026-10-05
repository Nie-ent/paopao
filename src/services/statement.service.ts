import * as XLSX from "xlsx"
import { extractText, getDocumentProxy } from "unpdf"
import prisma from "@/lib/db"
import { extractStatementRows, type StatementInput } from "@/services/ai.service"
import { isEncryptedPdf, markDuplicates, normalizeStatementDate, statementRowTimestamp, type StatementPreviewRow, type StatementRow } from "@/lib/statement"
import { normalizeReference } from "@/lib/slip"

export const MAX_STATEMENT_BYTES = 4 * 1024 * 1024 // Vercel caps request bodies at 4.5 MB

export class StatementError extends Error {
  constructor(public code: "TOO_LARGE" | "UNSUPPORTED" | "PASSWORD_REQUIRED" | "WRONG_PASSWORD" | "NO_ROWS") {
    super(code)
  }
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]

/** Turns an uploaded statement (PDF, CSV/Excel or screenshot) into what the AI should read. */
async function toStatementInput(file: File, password: string | undefined): Promise<StatementInput> {
  const bytes = Buffer.from(await file.arrayBuffer())
  const name = file.name.toLowerCase()

  if (file.type === "application/pdf" || name.endsWith(".pdf")) {
    if (!isEncryptedPdf(bytes)) return { kind: "file", data: bytes, mimeType: "application/pdf" }
    // The AI can't open protected PDFs, so decrypt and read the text layer here
    if (!password) throw new StatementError("PASSWORD_REQUIRED")
    try {
      const pdf = await getDocumentProxy(new Uint8Array(bytes), { password })
      const { text } = await extractText(pdf, { mergePages: true })
      return { kind: "text", text }
    } catch (error) {
      if ((error as { name?: string })?.name === "PasswordException") throw new StatementError("WRONG_PASSWORD")
      throw error
    }
  }

  if (/\.(csv|xlsx|xls)$/.test(name) || file.type.includes("spreadsheet") || file.type.includes("csv") || file.type.includes("excel")) {
    const workbook = XLSX.read(bytes, { type: "buffer", cellDates: true })
    // Real date cells are written as ISO dates; the default m/d/yy is ambiguous for Thai d/m statements
    const text = workbook.SheetNames.map(sheet => XLSX.utils.sheet_to_csv(workbook.Sheets[sheet], { blankrows: false, dateNF: "yyyy-mm-dd" })).join("\n")
    return { kind: "text", text }
  }

  if (IMAGE_TYPES.includes(file.type)) return { kind: "file", data: bytes, mimeType: file.type }

  throw new StatementError("UNSUPPORTED")
}

/** Reads a statement and flags rows that look like transactions the user already recorded. */
export async function previewStatement(userId: string, file: File, password?: string): Promise<StatementPreviewRow[]> {
  if (file.size > MAX_STATEMENT_BYTES) throw new StatementError("TOO_LARGE")

  // Read the file first so a bad file or password fails before any database or AI work
  const input = await toStatementInput(file, password)
  const customCategories = (await prisma.category.findMany({ where: { userId }, select: { name: true } })).map(c => c.name)
  const raw = await extractStatementRows(input, customCategories)

  const rows: StatementRow[] = raw.flatMap(r => {
    const date = normalizeStatementDate(r.date)
    const amount = Math.abs(Number(r.amount))
    if (!date || !Number.isFinite(amount) || amount <= 0) return []
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
