"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { recordPageView } from "@/features/analytics/actions"

/** Tells the admin page which dashboard pages people open (src/lib/feature-events.ts). Renders nothing. */
export function PageViewTracker() {
  const pathname = usePathname()
  useEffect(() => {
    if (pathname) recordPageView(pathname).catch(() => {})
  }, [pathname])
  return null
}
