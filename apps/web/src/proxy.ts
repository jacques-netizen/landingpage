import { NextResponse, type NextRequest } from 'next/server'
import { canAccess } from '@mde/config'
import { rolesForSessionToken, SESSION_COOKIES } from '@/server/viewer'

// Staff routes need a staff role, checked on the server before anything renders (03_SYSTEMS.md
// section 1). Pages and API handlers check again themselves; hiding links is never the protection.
export async function proxy(req: NextRequest) {
  const isApi = req.nextUrl.pathname.startsWith('/api/')
  const token = SESSION_COOKIES.map((n) => req.cookies.get(n)?.value).find(Boolean)
  const viewer = token ? await rolesForSessionToken(token) : null

  if (!viewer) {
    if (isApi)
      return NextResponse.json({ error: { code: 'unauthenticated', message: 'Sign in to continue.' } }, { status: 401 })
    const url = new URL('/staff/sign-in', req.url)
    url.searchParams.set('next', req.nextUrl.pathname)
    return NextResponse.redirect(url)
  }
  if (!canAccess(viewer.roles, 'staff')) {
    if (isApi)
      return NextResponse.json(
        { error: { code: 'forbidden', message: 'You do not have access to this.' } },
        { status: 403 },
      )
    return NextResponse.rewrite(new URL('/forbidden', req.url), { status: 403 })
  }
  return NextResponse.next()
}

export const config = { matcher: ['/admin', '/admin/:path*', '/api/v1/admin', '/api/v1/admin/:path*'] }
