/**
 * Runs a statement import from the browser as short requests (see src/lib/statement-job.ts):
 * prepare → the AI reads each chunk (two at a time, retried when the AI is busy) → finalize.
 * Reports progress after every step so the dialog can show a checklist.
 */
import type { RawStatementRow } from "@/services/ai.service"
import type { StatementPreviewRow } from "@/lib/statement"

export type ImportStep = "prepare" | "read" | "dedupe" | "done"
export type ImportProgress = { step: ImportStep; chunks: number; chunksDone: number; rowsFound: number; failedChunks: number }

export class ImportError extends Error {
  constructor(public code: string) { super(code) }
}

const CONCURRENCY = 2
const RETRY_DELAYS_MS = [2000, 5000]

async function postJson(url: string, body: unknown, signal?: AbortSignal) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

const wait = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const t = setTimeout(resolve, ms)
  signal?.addEventListener("abort", () => { clearTimeout(t); reject(new DOMException("Aborted", "AbortError")) }, { once: true })
})

/** Reads a statement file into preview rows, calling onProgress as it goes. Throws ImportError. */
export async function runStatementImport(opts: { file: File; password?: string; onProgress: (p: ImportProgress) => void; signal?: AbortSignal }): Promise<{ rows: StatementPreviewRow[]; failedChunks: number }> {
  const { file, password, onProgress, signal } = opts
  const progress: ImportProgress = { step: "prepare", chunks: 0, chunksDone: 0, rowsFound: 0, failedChunks: 0 }
  const report = () => onProgress({ ...progress })
  report()

  // 1. Prepare: read the file and split it (images are read completely here)
  const body = new FormData()
  body.append("file", file)
  if (password) body.append("password", password)
  const res = await fetch("/api/statements/prepare", { method: "POST", body, signal })
  const prep = await res.json().catch(() => ({}))
  if (!res.ok) throw new ImportError(prep.error ?? "FAILED")
  if (prep.rows) {
    progress.step = "done"; progress.rowsFound = prep.rows.length; report()
    return { rows: prep.rows, failedChunks: 0 }
  }
  const chunks: string[] = prep.chunks
  const token: string = prep.token
  progress.step = "read"; progress.chunks = chunks.length; report()

  // 2. The AI reads each chunk, a couple at a time; a busy AI gets two more tries
  const results: RawStatementRow[][] = new Array(chunks.length)
  let next = 0
  const readOne = async (index: number) => {
    for (let attempt = 0; ; attempt++) {
      const r = await postJson("/api/statements/chunk", { token, index, text: chunks[index] }, signal)
      if (r.ok) return r.data.rows as RawStatementRow[]
      if (r.status === 403) throw new ImportError("EXPIRED")
      if (attempt >= RETRY_DELAYS_MS.length) return null
      await wait(RETRY_DELAYS_MS[attempt], signal)
    }
  }
  const worker = async () => {
    while (next < chunks.length) {
      const index = next++
      const rows = await readOne(index)
      if (rows) { results[index] = rows; progress.rowsFound += rows.length } else progress.failedChunks++
      progress.chunksDone++
      report()
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, worker))
  if (progress.failedChunks === chunks.length) throw new ImportError("AI_BUSY")

  // 3. Clean up and flag what's already recorded (rows keep the statement's order)
  progress.step = "dedupe"; report()
  const fin = await postJson("/api/statements/finalize", { token, rows: results.flatMap(r => r ?? []) }, signal)
  if (!fin.ok) throw new ImportError(fin.data.error ?? "FAILED")
  progress.step = "done"; progress.rowsFound = fin.data.rows.length; report()
  return { rows: fin.data.rows, failedChunks: progress.failedChunks }
}
