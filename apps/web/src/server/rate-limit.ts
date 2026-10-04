import 'server-only'
import { env } from '@mde/config'
import Redis from 'ioredis'

const g = globalThis as unknown as { __mdeRedis?: Redis }

function redis() {
  if (!g.__mdeRedis)
    g.__mdeRedis = new Redis(env().REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: false,
    })
  return g.__mdeRedis
}

// Fixed window counter. Returns false when the caller is over the limit.
// If Redis is unreachable the request is allowed and the failure is logged, so an outage
// of the limiter never locks everyone out of signing in.
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const k = `rl:${key}:${Math.floor(Date.now() / 1000 / windowSeconds)}`
    const count = await redis().incr(k)
    if (count === 1) await redis().expire(k, windowSeconds)
    return count <= limit
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'rate limiter unavailable', err: String(err) }))
    return true
  }
}
