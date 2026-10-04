import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createSessionToken, verifySessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/lib/session'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Check Supabase session
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
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

  const isAuthPage = request.nextUrl.pathname.startsWith('/login')
  const isPdpaPage = request.nextUrl.pathname.startsWith('/pdpa')
  
  // If not logged in and not heading to login -> redirect to login
  if (!user && !isDemoUser && !isDirectLineSession && !isAuthPage && !request.nextUrl.pathname.startsWith('/api/')) {
    return redirectTo('/login')
  }

  // If logged in, but hasn't accepted PDPA, and not on PDPA page -> redirect to PDPA
  if ((user || isDemoUser || isDirectLineSession) && !hasAcceptedPDPA && !isPdpaPage && !request.nextUrl.pathname.startsWith('/api/')) {
    return redirectTo('/pdpa')
  }

  // If already logged in and heading to login or pdpa (when already accepted) -> redirect to dashboard
  if ((user || isDemoUser || isDirectLineSession)) {
    if (isAuthPage || (isPdpaPage && hasAcceptedPDPA)) {
      return redirectTo('/')
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
