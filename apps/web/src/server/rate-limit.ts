import 'server-only'
import { env } from '@mde/config'
import Redis from 'ioredis'

const g = globalThis as unknown as { __mdeRedis?: Redis }

function redis() {
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

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('rate limiter timed out')), ms)),
  ])
}
