// One deployment, two addresses: the brand site on the main domain (maisondelites.com) and the creator
// app with staff admin on its own subdomain (app.maisondelites.com). The main domain shows the brand
// site at "/" and sends everything that belongs to the app across; the app sends "/brands" back.
// With no BRAND_HOST set (previews, tests) nothing is routed and every page is served everywhere, except
// that Railway's own address always moves to the app address.

export type HostRoute = { kind: 'next' } | { kind: 'rewrite'; path: string } | { kind: 'redirect'; url: string }

/** Paths the brand domain serves itself: the brand site, its legal pages and shared files. */
const BRAND_PATHS = [/^\/$/, /^\/brands$/, /^\/for-clients(\/|$)/, /^\/legal(\/|$)/]
const SHARED_PATHS = [
  /^\/_next\//,
  /^\/designed\//,
  /^\/files\//,
  /^\/favicon/,
  /^\/robots\.txt$/,
  /^\/sitemap/,
  /^\/api\/health$/,
]
const ASSET = /\.(png|jpe?g|gif|webp|avif|svg|ico|mp4|webm|woff2?|ttf|css|js|txt|xml|json)$/i

/**
 * The address the visitor asked for. Proxies in front of the app (Cloudflare, Railway) may put the
 * public address in Host or X-Forwarded-Host and their own in the other, so a known address wins
 * over whatever comes first.
 */
export function pickHost(
  headers: { get(name: string): string | null },
  cfg: { brandHost?: string; appHost?: string },
): string | null {
  const known = [cfg.brandHost, cfg.brandHost && `www.${cfg.brandHost}`, cfg.appHost]
    .filter(Boolean)
    .map((h) => h!.toLowerCase())
  const forwarded = headers.get('forwarded')?.match(/host="?([^;,"]+)/i)?.[1]
  const candidates = [headers.get('x-forwarded-host'), forwarded, headers.get('x-original-host'), headers.get('host')]
    .flatMap((v) => (v ?? '').split(','))
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
  const match = candidates.find((c) => known.includes(c.replace(/:\d+$/, '')))
  if (match) return match
  // Cloudflare in front of the main domain, pointed at Railway's own address, forwards the request with
  // that address as Host. Only the main domain goes through Cloudflare (the app's record goes straight
  // to Railway), so a Railway-addressed request that came through Cloudflare is the main domain.
  const viaCloudflare = !!headers.get('cf-ray') || /cloudflare/i.test(headers.get('cdn-loop') ?? '')
  if (cfg.brandHost && viaCloudflare && candidates.every((c) => c.endsWith('.up.railway.app')))
    return cfg.brandHost.toLowerCase()
  return candidates[0] ?? null
}

export function routeForHost(
  host: string | null,
  path: string,
  search: string,
  cfg: { brandHost?: string; appHost?: string },
): HostRoute {
  const brand = cfg.brandHost?.toLowerCase()
  const app = cfg.appHost?.toLowerCase()
  if (!app || !host) return { kind: 'next' }
  const h = host.toLowerCase().replace(/:\d+$/, '')
  // Railway's own address (web-production-....up.railway.app) moves to the app's address, so people
  // always see app.maisondelites.com. Health checks are answered where they land.
  if (h.endsWith('.up.railway.app') && h !== app) {
    if (path === '/api/health') return { kind: 'next' }
    return { kind: 'redirect', url: `https://${app}${path}${search}` }
  }
  if (!brand || brand === app) return { kind: 'next' }
  if (h === `www.${brand}`) return { kind: 'redirect', url: `https://${brand}${path}${search}` }
  if (h === brand) {
    if (SHARED_PATHS.some((r) => r.test(path)) || ASSET.test(path)) return { kind: 'next' }
    if (path === '/') return { kind: 'rewrite', path: '/brands' }
    if (path === '/brands') return { kind: 'redirect', url: `https://${brand}/${search}` }
    if (BRAND_PATHS.some((r) => r.test(path))) return { kind: 'next' }
    return { kind: 'redirect', url: `https://${app}${path}${search}` }
  }
  if (h === app && (path === '/brands' || path.startsWith('/for-clients')))
    return { kind: 'redirect', url: `https://${brand}${path === '/brands' ? '/' : path}${search}` }
  return { kind: 'next' }
}
