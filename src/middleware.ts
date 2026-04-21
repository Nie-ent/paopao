import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

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
  const directLineSession = request.cookies.get('direct_line_session')?.value
  const isDirectLineSession = !!directLineSession

  // Automatically refresh the session sliding window if a direct line token exists
  if (isDirectLineSession) {
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    response.cookies.set('direct_line_session', directLineSession, {
      expires,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production"
    })
  }

  // Protection logic
  const isAuthPage = request.nextUrl.pathname.startsWith('/login')
  
  // If not logged in and not heading to login -> redirect to login
  if (!user && !isDemoUser && !isDirectLineSession && !isAuthPage && !request.nextUrl.pathname.startsWith('/api/')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // If already logged in and heading to login -> redirect to dashboard
  if ((user || isDemoUser || isDirectLineSession) && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
