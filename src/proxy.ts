import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createSessionToken, verifySessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/lib/session'

const PUBLIC_PAGES = ['/welcome', '/pricing', '/privacy']

/** LINE's in-app browser, where LIFF runs ("Line/<version>" in the user agent) */
const isLineInAppBrowser = (request: NextRequest) => /\bLine\//i.test(request.headers.get('user-agent') ?? '')

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } })

  const isDemoUser = request.cookies.get('demo_mode_bypass')?.value === 'true'
  // Only a correctly signed, unexpired cookie counts as a LINE session
  const sessionLineId = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)
  const isDirectLineSession = !!sessionLineId
  const hasAcceptedPDPA = request.cookies.get('pdpa_accepted')?.value === 'true'

  // An old unsigned, forged or expired cookie is removed from every response, redirects included
  const hasStaleSession = !sessionLineId && request.cookies.has(SESSION_COOKIE)
  const redirectTo = (pathname: string) => {
    const url = request.nextUrl.clone()
    url.pathname = pathname
    const redirect = NextResponse.redirect(url)
    if (hasStaleSession) redirect.cookies.delete(SESSION_COOKIE)
    return redirect
  }

  if (sessionLineId) {
    // Sliding 30-day window: re-issue the signed cookie with a fresh expiry
    const token = await createSessionToken(sessionLineId)
    if (token) response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions)
  } else if (hasStaleSession) {
    response.cookies.delete(SESSION_COOKIE)
  }

  // Protection logic
  // The admin area has its own password login, enforced in its server layout and actions
  if (request.nextUrl.pathname.startsWith('/admin')) return response

  const pathname = request.nextUrl.pathname
  const isAuthPage = pathname.startsWith('/login')
  const isPdpaPage = pathname.startsWith('/pdpa')
  const isSignedIn = isDemoUser || isDirectLineSession

  // Public marketing pages: anyone can read them, signed in or not, PDPA accepted or not
  if (PUBLIC_PAGES.some(p => pathname === p || pathname.startsWith(p + '/'))) return response

  // "/" is the landing page for visitors and the dashboard once signed in. The URL stays "/" so
  // the home page is what search engines index. LINE's in-app browser (LIFF) still goes to /login,
  // which signs the user in with one tap.
  if (pathname === '/' && !isSignedIn && !isLineInAppBrowser(request)) {
    const url = request.nextUrl.clone()
    url.pathname = '/welcome'
    const rewrite = NextResponse.rewrite(url)
    if (hasStaleSession) rewrite.cookies.delete(SESSION_COOKIE)
    return rewrite
  }
  
  // If not logged in and not heading to login -> redirect to login
  if (!isSignedIn && !isAuthPage && !request.nextUrl.pathname.startsWith('/api/')) {
    return redirectTo('/login')
  }

  // If logged in, but hasn't accepted PDPA, and not on PDPA page -> redirect to PDPA
  if (isSignedIn && !hasAcceptedPDPA && !isPdpaPage && !request.nextUrl.pathname.startsWith('/api/')) {
    return redirectTo('/pdpa')
  }

  // If already logged in and heading to login or pdpa (when already accepted) -> redirect to dashboard
  if (isSignedIn) {
    if (isAuthPage || (isPdpaPage && hasAcceptedPDPA)) {
      return redirectTo('/')
    }
  }

  return response
}

export const config = {
  matcher: [
    // Static files, robots.txt, sitemap.xml and llms.txt skip the proxy
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|txt|xml)$).*)',
  ],
}
