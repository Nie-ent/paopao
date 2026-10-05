import { describe, expect, it, vi } from "vitest"
import { isAiBusyError, withModelFallback } from "./ai"

const busy = () => Object.assign(new Error("high demand"), { status: 503 })
const retired = () => Object.assign(new Error("not found"), { status: 404 })
const opts = { models: ["a", "b"], retryDelaysMs: [0, 0] }

describe("withModelFallback", () => {
  it("falls through to the next model", async () => {
    const run = vi.fn(async (model: string) => { if (model === "a") throw busy(); return model })
    await expect(withModelFallback(run, opts)).resolves.toBe("b")
    expect(run).toHaveBeenCalledTimes(2)
  })

  it("retries the whole list when every model is busy", async () => {
    let calls = 0
    const run = vi.fn(async (model: string) => { if (++calls <= 2) throw busy(); return model })
    await expect(withModelFallback(run, opts)).resolves.toBe("a")
    expect(run).toHaveBeenCalledTimes(3)
  })

  it("gives up after the last round", async () => {
    const run = vi.fn(async () => { throw busy() })
    await expect(withModelFallback(run, opts)).rejects.toMatchObject({ status: 503 })
    expect(run).toHaveBeenCalledTimes(6)
  })

  it("does not retry errors that will not clear up", async () => {
    const run = vi.fn(async (model: string) => { throw model === "a" ? busy() : retired() })
    await expect(withModelFallback(run, opts)).rejects.toMatchObject({ status: 404 })
    expect(run).toHaveBeenCalledTimes(2)
  })
})

describe("isAiBusyError", () => {
  it("recognises temporary errors only", () => {
    expect([503, 429, 500].every(status => isAiBusyError({ status }))).toBe(true)
    expect(isAiBusyError({ status: 404 })).toBe(false)
    expect(isAiBusyError(new Error("x"))).toBe(false)
  })
})
