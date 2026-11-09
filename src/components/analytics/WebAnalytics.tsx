"use client"

import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { analyticsUrl } from "@/lib/analytics-url"

/**
 * Vercel Web Analytics (cookieless page views) and Speed Insights (real-user Core Web Vitals).
 * Both report URLs cleaned by analyticsUrl: no login codes or tokens, no admin pages.
 */
export function WebAnalytics() {
  return (
    <>
      <Analytics
        beforeSend={event => {
          const url = analyticsUrl(event.url)
          return url ? { ...event, url } : null
        }}
      />
      <SpeedInsights
        beforeSend={event => {
          const url = analyticsUrl(event.url)
          return url ? { ...event, url } : null
        }}
      />
    </>
  )
}
