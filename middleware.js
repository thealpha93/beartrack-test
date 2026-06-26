import { NextResponse } from 'next/server'

export async function middleware(request) {
  const { pathname } = request.nextUrl

  // Extract slug from first path segment
  const parts = pathname.split('/').filter(Boolean)
  const slug = parts[0]
  if (!slug) return NextResponse.next()

  // Skip auth routes and Next.js internals
  const isAuthRoute =
    pathname.includes('/login') ||
    pathname.includes('/invite/') ||
    pathname.includes('/reset-password/')

  if (!isAuthRoute) {
    const sessionCookie = request.cookies.get('beartracks_session')
    if (!sessionCookie?.value) {
      return NextResponse.redirect(new URL(`/${slug}/login`, request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|api/).*)'],
}
