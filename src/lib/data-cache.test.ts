import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const snapshot = vi.fn()
vi.mock("@/features/prefetch/actions", () => ({ getAppSnapshot: (...a: unknown[]) => snapshot(...a) }))

// The cache only runs in the browser
vi.stubGlobal("window", {})
const cache = await import("./data-cache")

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>(r => { resolve = r })
  return { promise, resolve }
}

describe("data cache", () => {
  beforeEach(() => { cache.clearAll(); snapshot.mockReset() })
  afterEach(() => { vi.useRealTimers() })

  it("serves fresh data without asking again, and shares one call per key", async () => {
    const fetcher = vi.fn().mockResolvedValue({ n: 1 })
    const [a, b] = await Promise.all([cache.load("k", fetcher), cache.load("k", fetcher)])
    expect(a).toEqual({ n: 1 })
    expect(b).toBe(a)
    await cache.load("k", fetcher)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(cache.peek("k")).toEqual({ n: 1 })
  })

  it("asks again once stale, after invalidateAll, and when forced; keeps old data meanwhile", async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2).mockResolvedValueOnce(3).mockResolvedValueOnce(4)
    await cache.load("k", fetcher)
    vi.advanceTimersByTime(cache.FRESH_MS + 1)
    const p = cache.load("k", fetcher)
    expect(cache.peek("k")).toBe(1) // stale value stays visible while refreshing
    expect(await p).toBe(2)
    cache.invalidateAll()
    expect(await cache.load("k", fetcher)).toBe(3)
    expect(await cache.load("k", fetcher, { force: true })).toBe(4)
    expect(fetcher).toHaveBeenCalledTimes(4)
  })

  it("keeps the newest answer when an older request finishes last", async () => {
    const slow = deferred<string>()
    const first = cache.load("k", () => slow.promise)
    await cache.load("k", async () => "new", { force: true })
    slow.resolve("old")
    await first
    expect(cache.peek("k")).toBe("new")
  })

  it("lets pages wait for the app snapshot instead of sending their own request", async () => {
    const snap = deferred<Record<string, unknown>>()
    snapshot.mockReturnValue(snap.promise)
    cache.prefetchApp("th-TH")
    cache.prefetchApp("th-TH") // once per page load
    expect(snapshot).toHaveBeenCalledTimes(1)
    expect(snapshot.mock.calls[0][0]).toMatchObject({ locale: "th-TH" })

    const bills = vi.fn().mockResolvedValue("own bills")
    const goals = vi.fn().mockResolvedValue("own goals")
    const pBills = cache.load("bills", bills)
    const pGoals = cache.load("goals", goals)
    snap.resolve({ bills: "snapshot bills" })
    expect(await pBills).toBe("snapshot bills")
    expect(bills).not.toHaveBeenCalled()
    expect(await pGoals).toBe("own goals") // not in the snapshot: fetched after it
    expect(goals).toHaveBeenCalledTimes(1)
  })

  it("survives a failed snapshot, and clearAll forgets everything", async () => {
    snapshot.mockRejectedValue(new Error("offline"))
    cache.prefetchApp("en-US")
    expect(await cache.load("bills", async () => "own")).toBe("own")
    cache.clearAll()
    expect(cache.peek("bills")).toBeUndefined()
  })
})
