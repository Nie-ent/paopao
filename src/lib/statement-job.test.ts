import { beforeAll, describe, expect, it, vi } from "vitest"
import { isJobChunk, readStatementJob, signStatementJob } from "./statement-job"

beforeAll(() => { vi.stubEnv("SESSION_SECRET", "test-secret") })

describe("statement import job token", () => {
  const chunks = ["date,amount\n2026-11-01,100", "date,amount\n2026-11-02,200"]

  it("covers exactly the user's chunks, for 30 minutes", () => {
    const now = Date.now()
    const token = signStatementJob("u1", chunks, now)
    const job = readStatementJob(token, "u1", now)!
    expect(job).not.toBeNull()
    expect(isJobChunk(job, 0, chunks[0])).toBe(true)
    expect(isJobChunk(job, 1, chunks[1])).toBe(true)
    expect(isJobChunk(job, 0, chunks[1])).toBe(false) // wrong index
    expect(isJobChunk(job, 0, chunks[0] + " ")).toBe(false) // any other text: no free AI calls
    expect(isJobChunk(job, 2, chunks[0])).toBe(false)
    expect(isJobChunk(job, "0", chunks[0])).toBe(false)
    expect(readStatementJob(token, "u2", now)).toBeNull() // someone else's
    expect(readStatementJob(token, "u1", now + 31 * 60 * 1000)).toBeNull() // expired
  })

  it("rejects a token that was changed or isn't one", () => {
    const token = signStatementJob("u1", chunks)
    const [payload, mac] = token.split(".")
    const forged = Buffer.from(JSON.stringify({ u: "u1", h: ["x"], exp: Date.now() + 1e9 })).toString("base64url")
    expect(readStatementJob(`${forged}.${mac}`, "u1")).toBeNull()
    expect(readStatementJob(`${payload}.x${mac.slice(1)}`, "u1")).toBeNull()
    for (const bad of [undefined, 42, "", "abc", "a.b.c"]) expect(readStatementJob(bad, "u1")).toBeNull()
  })
})
