"use client"

import { Analytics } from "@vercel/analytics/next"
import { analyticsUrl } from "@/lib/analytics-url"

/** Vercel Web Analytics (cookieless page views), with URLs cleaned by analyticsUrl. */
export function WebAnalytics() {
  return (
    <Analytics
      beforeSend={event => {
        const url = analyticsUrl(event.url)
        return url ? { ...event, url } : null
      }}
    />
  )
}
