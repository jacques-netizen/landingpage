import 'server-only'
import { env } from '@mde/config'
import { db } from '@mde/db'
import { keyFromHeader, type PartnerKey } from '@mde/partners'
import { NextResponse } from 'next/server'
import { rateLimit } from './rate-limit'

// The partner API's shared plumbing (owner decision, 2026-10-28): every request needs a partner key in
// the Authorization header, is limited to 600 a minute per key, and every error has the same shape.
// Documented at /developers.

export const RATE_LIMIT_PER_MINUTE = 600

export type ErrorType = 'unauthorized' | 'not_found' | 'invalid_request' | 'rate_limited' | 'server_error'
const STATUS: Record<ErrorType, number> = {
  unauthorized: 401,
  not_found: 404,
  invalid_request: 400,
  rate_limited: 429,
  server_error: 500,
}

export function apiError(type: ErrorType, message: string, extra: Record<string, string> = {}) {
  return NextResponse.json({ error: { type, message } }, { status: STATUS[type], headers: extra })
}

export const apiBase = () => env().APP_URL.replace(/\/$/, '')

type Handler = (key: PartnerKey, req: Request) => Promise<Response>

/** Run a handler for an authenticated partner key, with the rate limit and error handling. */
export async function withKey(req: Request, handler: Handler): Promise<Response> {
  const key = await keyFromHeader(db(), req.headers.get('authorization'))
  if (!key)
    return apiError('unauthorized', 'Send a valid API key as "Authorization: Bearer <key>".', {
      'www-authenticate': 'Bearer',
    })
  if (!(await rateLimit(`partner-api:${key.id}`, RATE_LIMIT_PER_MINUTE, 60)))
    return apiError('rate_limited', `Too many requests: the limit is ${RATE_LIMIT_PER_MINUTE} a minute per key.`, {
      'retry-after': '60',
    })
  try {
    const res = await handler(key, req)
    res.headers.set('cache-control', 'no-store')
    return res
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'partner api failed', url: req.url, err: String(err) }))
    return apiError('server_error', 'Something went wrong on our side. Try again in a moment.')
  }
}

/** `limit` from 1 to 100 (default 25), and the cursor from the previous page. */
export function pageParams(req: Request): { limit: number; cursor: string | null } | Response {
  const sp = new URL(req.url).searchParams
  const raw = sp.get('limit')
  const limit = raw === null ? 25 : Number(raw)
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    return apiError('invalid_request', 'limit must be a whole number from 1 to 100.')
  return { limit, cursor: sp.get('cursor') }
}

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status })
