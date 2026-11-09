/**
 * In-memory client cache for the dashboard pages' server actions (stale-while-revalidate).
 *
 * Pages read data with Server Actions, which Next dispatches one at a time, so opening a
 * page used to wait for several round trips in a row. Here:
 * - `prefetchApp` loads every page's first screen with one action (the app snapshot) and
 *   fills the cache, so moving between pages renders immediately.
 * - `peek` gives a page its cached data on first render; `load` returns the cached value
 *   while it is fresh and asks the server otherwise.
 * - `invalidateAll` after a change marks everything stale, so each page refreshes the next
 *   time it opens (it still shows the old data until the new data arrives).
 *
 * The cache lives in memory only: it is per tab, empty on a full reload, and cleared on sign out.
 */
import { getAppSnapshot } from "@/features/prefetch/actions"
import type { Locale } from "@/lib/cache-keys"

type Entry = { data?: unknown; at: number; hasData: boolean }

/** How long cached data counts as fresh before a page asks the server again */
export const FRESH_MS = 30_000

const store = new Map<string, Entry>()
const inflight = new Map<string, { seq: number; promise: Promise<unknown> }>()
let seq = 0
let snapshot: Promise<void> | null = null
let snapshotDone = false

function isFresh(e: Entry | undefined, now = Date.now()) {
  return !!e && e.hasData && now - e.at < FRESH_MS
}

/** The cached value for a key, fresh or stale, or undefined. */
export function peek<T>(key: string): T | undefined {
  if (typeof window === "undefined") return undefined
  return store.get(key)?.data as T | undefined
}

export function prime(key: string, data: unknown, at = Date.now()) {
  store.set(key, { data, at, hasData: true })
}

/**
 * The value for a key: the cached one while fresh, otherwise from `fetcher` (requests for the
 * same key share one call). `force` always asks the server. While the app snapshot is loading,
 * a page waits for it rather than sending a request of its own.
 */
export function load<T>(key: string, fetcher: () => Promise<T>, opts: { force?: boolean } = {}): Promise<T> {
  if (typeof window === "undefined") return fetcher()
  const force = !!opts.force
  if (!force && isFresh(store.get(key))) return Promise.resolve(store.get(key)!.data as T)
  const running = inflight.get(key)
  if (!force && running) return running.promise as Promise<T>

  const mine = ++seq
  const promise = (async () => {
    if (!force && snapshot) {
      await snapshot
      if (isFresh(store.get(key))) return store.get(key)!.data as T
    }
    const data = await fetcher()
    // A newer request for this key may have finished first; keep the newer answer
    if (inflight.get(key)?.seq === mine) prime(key, data)
    return data
  })().finally(() => {
    if (inflight.get(key)?.seq === mine) inflight.delete(key)
  })
  inflight.set(key, { seq: mine, promise })
  return promise
}

/** Marks every cached value stale; they are refetched the next time a page loads them. */
export function invalidateAll() {
  for (const e of store.values()) e.at = 0
}

/** Forgets everything, e.g. on sign out, so the next user never sees this user's data. */
export function clearAll() {
  store.clear()
  inflight.clear()
  snapshot = null
  snapshotDone = false
}

/**
 * Loads the first screen of every dashboard page in one request and caches it. Runs once per
 * page load; later calls do nothing. Failure is harmless: pages then fetch their own data.
 */
export function prefetchApp(locale: Locale) {
  if (typeof window === "undefined" || snapshot || snapshotDone) return
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  snapshot = getAppSnapshot({ month, year, locale })
    .then(entries => {
      const at = Date.now()
      for (const [key, data] of Object.entries(entries ?? {})) {
        // Don't overwrite data a page fetched itself in the meantime
        if (!isFresh(store.get(key), at)) prime(key, data, at)
      }
    })
    .catch(() => {})
    .finally(() => {
      snapshot = null
      snapshotDone = true
    })
}
