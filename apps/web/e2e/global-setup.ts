import Redis from 'ioredis'

// Clear sign-in rate limit counters so repeated local and CI runs start clean.
export default async function globalSetup() {
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: 1 })
  const keys = await redis.keys('rl:*')
  if (keys.length) await redis.del(...keys)
  await redis.quit()
}
