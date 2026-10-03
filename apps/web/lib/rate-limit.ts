/**
 * Fixed window limiter held in memory. Good enough for one server process in development.
 * Production runs behind several instances and swaps this for Redis (see DECISIONS.md).
 */
const buckets = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  const hit = buckets.get(key)
  if (!hit || hit.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true as const }
  }
  hit.count += 1
  if (hit.count > limit) return { ok: false as const, retryAfterMs: hit.resetAt - now }
  return { ok: true as const }
}

export function resetRateLimits() {
  buckets.clear()
}
