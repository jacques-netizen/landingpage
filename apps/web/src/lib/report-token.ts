import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

// The client's report link (client report brief, 2026-10-12): a signed token, never a raw campaign id.
// The signing key is derived from the server secret and the campaign's own report secret, so rotating
// the campaign's secret revokes every link issued for it.
export type ReportTokenPayload = { c: string; iat: number; exp?: number }

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url')

export function newReportSecret() {
  return randomBytes(24).toString('base64url')
}

export function reportKey(serverSecret: string, campaignSecret: string) {
  return createHmac('sha256', serverSecret).update(`report:${campaignSecret}`).digest()
}

export function signReportToken(payload: ReportTokenPayload, key: Buffer) {
  const body = b64(JSON.stringify(payload))
  const sig = createHmac('sha256', key).update(body).digest('base64url')
  return `${body}.${sig}`
}

/** The payload as written, before the signature is checked: it says which campaign's key to use. */
export function readReportToken(token: string): ReportTokenPayload | null {
  const [body] = token.split('.')
  if (!body) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as ReportTokenPayload
    return typeof p?.c === 'string' && /^[0-9a-f-]{36}$/i.test(p.c) && typeof p.iat === 'number' ? p : null
  } catch {
    return null
  }
}

/** The payload when the signature matches the key and the token has not expired; otherwise null. */
export function verifyReportToken(token: string, key: Buffer, now = Date.now()): ReportTokenPayload | null {
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = createHmac('sha256', key).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  const p = readReportToken(token)
  if (!p) return null
  if (p.exp !== undefined && p.exp * 1000 <= now) return null
  return p
}
