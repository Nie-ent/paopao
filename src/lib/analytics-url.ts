/**
 * The URL we report to Vercel Web Analytics: no hash, and only utm_* query parameters.
 * LINE Login and LIFF put one-time codes, state and tokens in the URL (?code=, ?liff.state=,
 * #access_token=), which must not leave the app. Admin pages are not reported at all.
 */
export function analyticsUrl(raw: string): string | null {
  let url: URL
  try { url = new URL(raw) } catch { return null }
  if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) return null
  const kept = new URLSearchParams()
  for (const [k, v] of url.searchParams) if (/^utm_[a-z]+$/i.test(k)) kept.append(k, v)
  url.search = kept.toString()
  url.hash = ""
  return url.toString()
}
