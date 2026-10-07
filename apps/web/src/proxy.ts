import { NextResponse, type NextRequest } from 'next/server'
import { canAccess } from '@mde/config'
import { pickHost, routeForHost } from '@/server/hosts'
import { rolesForSessionToken, SESSION_COOKIES } from '@/server/viewer'

const STAFF_PATH = /^\/(admin|api\/v1\/admin)(\/|$)/

// Staff routes need a staff role, checked on the server before anything renders (03_SYSTEMS.md
// section 1). Pages and API handlers check again themselves; hiding links is never the protection.
export async function proxy(req: NextRequest) {
  // First, which address was asked for: the brand domain or the app (see server/hosts.ts).
  const cfg = {
    brandHost: process.env.BRAND_HOST?.trim().toLowerCase(),
    appHost: process.env.APP_URL ? new URL(process.env.APP_URL).host : undefined,
  }
  const route = routeForHost(pickHost(req.headers, cfg), req.nextUrl.pathname, req.nextUrl.search, cfg)
  if (route.kind === 'redirect') return NextResponse.redirect(route.url, 307)
  if (route.kind === 'rewrite') {
    // Same origin as the request, so Next serves the page itself instead of fetching it over the network.
    const url = req.nextUrl.clone()
    url.pathname = route.path
    return NextResponse.rewrite(url)
  }
  if (!STAFF_PATH.test(req.nextUrl.pathname)) return NextResponse.next()

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

// Every request except Next's own build files, so the address routing sees each page.
// Uploads skip it: the proxy buffers request bodies only up to 10 MB, and the upload route checks staff itself.
export const config = { matcher: ['/((?!_next/static|_next/image|api/admin/uploads).*)'] }
