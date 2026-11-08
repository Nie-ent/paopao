"use client"

import { useCallback, useRef, useState } from "react"

/**
 * Runs one async action at a time. A ref blocks repeat clicks immediately (a disabled button
 * only takes effect after React re-renders, so a fast double click can slip through), and
 * `pending` drives the button's loading state. `key` says which item is busy, for per-row buttons.
 *
 *   const { run, pending, pendingKey } = useSingleFlight()
 *   <Button loading={pendingKey === tx.id} onClick={() => run(() => deleteTx(tx.id), tx.id)}>
 */
export function useSingleFlight() {
  const busy = useRef(false)
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  const run = useCallback(async <T,>(action: () => Promise<T>, key = "default"): Promise<T | undefined> => {
    if (busy.current) return undefined
    busy.current = true
    setPendingKey(key)
    try {
      return await action()
    } finally {
      busy.current = false
      setPendingKey(null)
    }
  }, [])

  return { run, pending: pendingKey !== null, pendingKey }
}
