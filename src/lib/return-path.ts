/**
 * Where to send a user after LINE opens the app or after they sign in.
 *
 * A rich-menu link like https://liff.line.me/<id>/bills opens the LIFF endpoint as
 * "/?liff.state=%2Fbills". Only the LIFF SDK reads that, and only on a page that calls
 * liff.init, so the proxy resolves it instead. The same path is kept in a cookie while
 * the user signs in, so they land where they were heading.
 */
export const RETURN_PATH_COOKIE = "return_to"

const BLOCKED = ["/api", "/login", "/pdpa", "/admin", "/_next"]

/** A same-site path we may redirect to, or null. Rejects other hosts ("//x", "/\\x", "https:") and auth pages. */
export function safeReturnPath(raw: string | null | undefined): string | null {
  if (!raw) return null
  let path = raw.trim()
  // liff.state may arrive encoded once more than usual
  if (/^%2F/i.test(path)) {
    try { path = decodeURIComponent(path) } catch { return null }
  }
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return null
  if (/[\u0000-\u001f\\]/.test(path)) return null
  const pathname = path.split(/[?#]/)[0]
  if (pathname === "/") return null
  if (BLOCKED.some(b => pathname === b || pathname.startsWith(b + "/"))) return null
  return path.length > 512 ? null : path
}
