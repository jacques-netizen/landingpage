import 'server-only'
import { env } from '@mde/config'
import Redis from 'ioredis'
import { clientIp } from './client-ip'

const g = globalThis as unknown as { __mdeRedis?: Redis }

export function redis() {
  // Commands queue while the first connection opens, so the first request after start is limited too.
  if (!g.__mdeRedis) g.__mdeRedis = new Redis(env().REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 2000 })
  return g.__mdeRedis
}

// Fixed window counter. Returns false when the caller is over the limit.
// If Redis is unreachable the request is allowed and the failure is logged, so an outage
// of the limiter never locks everyone out of signing in.
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const k = `rl:${key}:${Math.floor(Date.now() / 1000 / windowSeconds)}`
    const count = await withTimeout(
      redis()
        .multi()
        .incr(k)
        .expire(k, windowSeconds, 'NX')
        .exec()
        .then((r) => Number(r?.[0]?.[1])),
      2000,
    )
    return count <= limit
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'rate limiter unavailable', err: String(err) }))
    return true
  }
}

/**
 * A per-visitor limit for a public endpoint (owner, 2026-11-13: rate limiting on all public endpoints).
 * Returns the polite 429 to send back, with how long to wait, or null when the visitor is within it.
 */
export async function limitVisitor(name: string, limit: number, windowSeconds: number): Promise<Response | null> {
  if (await rateLimit(`${name}:ip:${await clientIp()}`, limit, windowSeconds)) return null
  return tooManyRequests(windowSeconds - (Math.floor(Date.now() / 1000) % windowSeconds))
}

/** The answer to a caller over a limit: 429, a JSON error in the platform's shape and Retry-After. */
export function tooManyRequests(retryAfterSeconds: number) {
  return Response.json(
    { error: { code: 'rate_limited', message: 'Too many requests. Please wait a moment and try again.' } },
    { status: 429, headers: { 'retry-after': String(Math.max(1, retryAfterSeconds)), 'cache-control': 'no-store' } },
  )
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('rate limiter timed out')), ms)),
  ])
}
