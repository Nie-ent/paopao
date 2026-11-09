/**
 * A statement import runs as several short requests (prepare → one per chunk → finalize) so no
 * single request hits Vercel's time limit and the browser can show progress. The prepare step
 * meters the user's quota once and signs this token over the chunks it produced; the chunk and
 * finalize steps only accept work the token covers, so they can't be used for free AI calls.
 */
import crypto from "node:crypto"

const TTL_MS = 30 * 60 * 1000

type Job = { u: string; h: string[]; exp: number }

const secret = () => {
  const s = process.env.SESSION_SECRET
  if (!s) throw new Error("SESSION_SECRET is not set")
  return s
}
const sha = (text: string) => crypto.createHash("sha256").update(text).digest("base64url").slice(0, 22)
const sign = (payload: string) => crypto.createHmac("sha256", secret()).update(`statement-job:${payload}`).digest("base64url")

/** Token for a user's chunks, valid for 30 minutes. */
export function signStatementJob(userId: string, chunks: string[], now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ u: userId, h: chunks.map(sha), exp: now + TTL_MS } satisfies Job)).toString("base64url")
  return `${payload}.${sign(payload)}`
}

/** The job, if the token is genuine, unexpired and the user's; otherwise null. */
export function readStatementJob(token: unknown, userId: string, now = Date.now()): Job | null {
  if (typeof token !== "string" || token.length > 20_000) return null
  const [payload, mac] = token.split(".")
  if (!payload || !mac) return null
  const expected = sign(payload)
  if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null
  try {
    const job = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Job
    return job.u === userId && job.exp > now && Array.isArray(job.h) ? job : null
  } catch {
    return null
  }
}

/** Whether `text` is chunk `index` of the job (exactly what prepare produced). */
export function isJobChunk(job: Job, index: unknown, text: unknown) {
  return Number.isInteger(index) && (index as number) >= 0 && (index as number) < job.h.length && typeof text === "string" && sha(text) === job.h[index as number]
}
