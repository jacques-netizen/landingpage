// Signed links so a reader can change email preferences in one click without signing in.
import { env } from '@mde/config'
import { createHmac, timingSafeEqual } from 'node:crypto'

const sign = (userId: string) =>
  createHmac('sha256', env().AUTH_SECRET).update(`email-preferences:${userId}`).digest('base64url')

export function preferencesToken(userId: string) {
  return sign(userId)
}

export function verifyPreferencesToken(userId: string, token: string) {
  const a = Buffer.from(sign(userId))
  const b = Buffer.from(token)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function preferenceLinks(userId: string) {
  const q = `u=${encodeURIComponent(userId)}&t=${preferencesToken(userId)}`
  const base = env().APP_URL.replace(/\/$/, '')
  return { preferencesUrl: `${base}/email-preferences?${q}`, unsubscribeUrl: `${base}/api/unsubscribe?${q}` }
}
