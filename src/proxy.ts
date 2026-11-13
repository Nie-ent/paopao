import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createSessionToken, verifySessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/lib/session'
import { RETURN_PATH_COOKIE, safeReturnPath } from '@/lib/return-path'
import { canonicalRedirect } from '@/lib/site'

const PUBLIC_PAGES = ['/welcome', '/en', '/pricing', '/privacy', '/guides', '/r']

/** Pages for LINE group members, who need no PaoPao account (src/app/split) */
const isGroupPage = (path: string) => path.split(/[?#]/)[0].startsWith('/split/')

/** LINE's in-app browser, where LIFF runs ("Line/<version>" in the user agent) */
const isLineInAppBrowser = (request: NextRequest) => /\bLine\//i.test(request.headers.get('user-agent') ?? '')

export async function proxy(request: NextRequest) {
  // One address for search engines: *.vercel.app copies of production redirect to the real domain
  const canonical = canonicalRedirect(request.nextUrl.host, request.nextUrl.pathname)
  if (canonical) return NextResponse.redirect(new URL(request.nextUrl.pathname + request.nextUrl.search, canonical), 308)

  const response = NextResponse.next({ request: { headers: request.headers } })

  const isDemoUser = request.cookies.get('demo_mode_bypass')?.value === 'true'
  // Only a correctly signed, unexpired cookie counts as a LINE session
  const sessionLineId = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)
  const isDirectLineSession = !!sessionLineId
  const hasAcceptedPDPA = request.cookies.get('pdpa_accepted')?.value === 'true'

  // An old unsigned, forged or expired cookie is removed from every response, redirects included
  const hasStaleSession = !sessionLineId && request.cookies.has(SESSION_COOKIE)
  const redirectTo = (pathname: string, { remember }: { remember?: string | null } = {}) => {
    const url = request.nextUrl.clone()
    url.pathname = pathname
    // liff.state is resolved here; left on /login, liff.init would bounce to it before sign-in
    url.searchParams.delete('liff.state')
    const redirect = NextResponse.redirect(url)
    if (hasStaleSession) redirect.cookies.delete(SESSION_COOKIE)
    if (remember) redirect.cookies.set(RETURN_PATH_COOKIE, remember, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 600 })
    return redirect
  }
  /** Send a signed-in user to a saved page (LIFF deep link or the page they asked for before login) */
  const redirectToReturnPath = (path: string) => {
    const redirect = NextResponse.redirect(new URL(path, request.nextUrl.origin))
    redirect.cookies.delete(RETURN_PATH_COOKIE)
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

  // Rich-menu / Flex links open "/?liff.state=%2Fbills": go straight there, or remember it through sign-in
  const liffTarget = safeReturnPath(request.nextUrl.searchParams.get('liff.state'))
  const savedTarget = safeReturnPath(request.cookies.get(RETURN_PATH_COOKIE)?.value)
  if (liffTarget) {
    // The bill-splitting page is for everyone in a LINE group, PaoPao users or not: it signs in with LIFF itself
    if (isGroupPage(liffTarget)) return NextResponse.redirect(new URL(liffTarget, request.url))
    if (isSignedIn && hasAcceptedPDPA) return redirectToReturnPath(liffTarget)
    return redirectTo(isSignedIn ? '/pdpa' : '/login', { remember: liffTarget })
  }

  // Public marketing pages: anyone can read them, signed in or not, PDPA accepted or not
  if (PUBLIC_PAGES.some(p => pathname === p || pathname.startsWith(p + '/'))) return response
  if (isGroupPage(pathname)) return response

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
    return redirectTo('/login', { remember: safeReturnPath(pathname + request.nextUrl.search) })
  }

  // If logged in, but hasn't accepted PDPA, and not on PDPA page -> redirect to PDPA
  if (isSignedIn && !hasAcceptedPDPA && !isPdpaPage && !request.nextUrl.pathname.startsWith('/api/')) {
    return redirectTo('/pdpa')
  }

  // If already logged in and heading to login or pdpa (when already accepted) -> redirect to dashboard
  if (isSignedIn) {
    // Just signed in (or accepted PDPA): finish the trip to the page they were heading for
    if (savedTarget && hasAcceptedPDPA && (pathname === '/' || isAuthPage || isPdpaPage)) {
      return redirectToReturnPath(savedTarget)
    }
    if (isAuthPage || (isPdpaPage && hasAcceptedPDPA)) {
      return redirectTo('/')
    }
  }

  return response
}

export const config = {
  matcher: [
    // Static files, robots.txt, sitemap.xml, llms.txt and Vercel's analytics scripts skip the proxy
    '/((?!_next/static|_next/image|_vercel/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|txt|xml)$).*)',
  ],
}
