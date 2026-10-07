import { describe, expect, it } from 'vitest'
import { pickHost, routeForHost } from '../src/server/hosts'

const cfg = { brandHost: 'maisondelites.com', appHost: 'app.maisondelites.com' }
const r = (host: string, path: string, search = '') => routeForHost(host, path, search, cfg)

describe('two addresses, one deployment', () => {
  it('shows the brand site at the root of the main domain', () => {
    expect(r('maisondelites.com', '/')).toEqual({ kind: 'rewrite', path: '/brands' })
    expect(r('maisondelites.com', '/brands')).toEqual({ kind: 'redirect', url: 'https://maisondelites.com/' })
    expect(r('maisondelites.com', '/for-clients')).toEqual({ kind: 'next' })
    expect(r('maisondelites.com', '/legal/brand-terms')).toEqual({ kind: 'next' })
  })

  it('sends creator and staff pages from the main domain to the app', () => {
    expect(r('maisondelites.com', '/campaigns', '?type=music')).toEqual({
      kind: 'redirect',
      url: 'https://app.maisondelites.com/campaigns?type=music',
    })
    for (const p of ['/sign-up', '/sign-in', '/wallet', '/admin', '/staff/sign-in', '/api/auth/session', '/fees'])
      expect(r('maisondelites.com', p).kind, p).toBe('redirect')
  })

  it('serves shared files and assets on both', () => {
    for (const p of ['/_next/static/x.js', '/designed/logo.png', '/files/abc/a.png', '/favicon.ico', '/api/health'])
      expect(r('maisondelites.com', p), p).toEqual({ kind: 'next' })
  })

  it('sends www to the main domain and the brand pages from the app to the main domain', () => {
    expect(r('www.maisondelites.com', '/x')).toEqual({ kind: 'redirect', url: 'https://maisondelites.com/x' })
    expect(r('app.maisondelites.com', '/brands')).toEqual({ kind: 'redirect', url: 'https://maisondelites.com/' })
    expect(r('app.maisondelites.com', '/')).toEqual({ kind: 'next' })
    expect(r('app.maisondelites.com', '/campaigns')).toEqual({ kind: 'next' })
  })

  it('does nothing without an app address, or on any other address', () => {
    expect(routeForHost('localhost:3000', '/', '', {})).toEqual({ kind: 'next' })
    expect(routeForHost('localhost:3100', '/campaigns', '', { appHost: 'localhost:3100' })).toEqual({ kind: 'next' })
    expect(r('preview.example.com', '/campaigns')).toEqual({ kind: 'next' })
  })

  it("sends Railway's own address to the app address, keeping the page, but answers health checks", () => {
    expect(r('web-production-5c853d.up.railway.app', '/campaigns', '?x=1')).toEqual({
      kind: 'redirect',
      url: 'https://app.maisondelites.com/campaigns?x=1',
    })
    expect(r('web-production-5c853d.up.railway.app', '/api/health')).toEqual({ kind: 'next' })
    expect(
      routeForHost('web-production-5c853d.up.railway.app', '/wallet', '', { appHost: 'app.maisondelites.com' }),
    ).toEqual({ kind: 'redirect', url: 'https://app.maisondelites.com/wallet' })
    // When the app address itself is the Railway one, nothing moves.
    expect(
      routeForHost('web-production-5c853d.up.railway.app', '/wallet', '', {
        appHost: 'web-production-5c853d.up.railway.app',
      }),
    ).toEqual({ kind: 'next' })
  })

  it('picks the public address when a proxy puts its own address first', () => {
    const h = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null })
    expect(
      pickHost(h({ host: 'maisondelites.com', 'x-forwarded-host': 'web-production-5c853d.up.railway.app' }), cfg),
    ).toBe('maisondelites.com')
    expect(pickHost(h({ host: 'x.up.railway.app', 'x-forwarded-host': 'app.maisondelites.com' }), cfg)).toBe(
      'app.maisondelites.com',
    )
    expect(
      pickHost(h({ host: 'x.up.railway.app', forwarded: 'for=1.2.3.4;host=maisondelites.com;proto=https' }), cfg),
    ).toBe('maisondelites.com')
    expect(pickHost(h({ host: 'web-production-5c853d.up.railway.app' }), cfg)).toBe(
      'web-production-5c853d.up.railway.app',
    )
    // The main domain through Cloudflare, forwarded to Railway's own address.
    expect(pickHost(h({ host: 'web-production-5c853d.up.railway.app', 'cf-ray': 'a46f635eae23cef2-EWR' }), cfg)).toBe(
      'maisondelites.com',
    )
    expect(pickHost(h({ host: 'app.maisondelites.com', 'cf-ray': 'x' }), cfg)).toBe('app.maisondelites.com')
  })
})
