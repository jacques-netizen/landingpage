import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '@mde/config'

// Whop payouts (owner, 2026-11-24: "deposit the money in the platform through Whop and pay out the
// creators through that"). The company tops up its Whop balance in the Whop dashboard. Each clipper
// gets a Whop payout account (a subaccount of the company's) and verifies their identity on Whop's own
// page; a verified withdrawal is paid as a Whop transfer from the company balance to that account, and
// the clipper cashes out from Whop to their bank, PayPal or crypto. Docs: https://docs.whop.com
// (accounts, account_links, transfers, webhooks). The API key never leaves the server.

const API_VERSION = '2026-11-23-3'

export class WhopError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

export function whopEnabled() {
  const e = env()
  return !!(e.WHOP_API_KEY && e.WHOP_COMPANY_ID)
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const e = env()
  if (!e.WHOP_API_KEY) throw new WhopError('Whop is not set up.', 0)
  const res = await fetch(`${e.WHOP_API_URL.replace(/\/$/, '')}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${e.WHOP_API_KEY}`,
      'api-version-date': API_VERSION,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  })
  const text = await res.text()
  if (!res.ok) {
    let message = `Whop answered ${res.status}`
    try {
      const j = JSON.parse(text) as { error?: { message?: string }; message?: string }
      message = j.error?.message ?? j.message ?? message
    } catch {
      // Not JSON: keep the status message.
    }
    throw new WhopError(message, res.status)
  }
  return (text ? JSON.parse(text) : {}) as T
}

export type WhopAccount = {
  id: string
  verification?: { individual?: { status?: string } | null } | null
  capabilities?: Record<string, string> | null
  required_actions?: unknown[] | null
}

/** A payout account for one clipper, keyed by their user id so a retry never makes a second one. */
export function createAccount(i: { userId: string; email: string; title: string }) {
  return call<WhopAccount>('POST', '/accounts', {
    email: i.email,
    title: i.title,
    external_id: i.userId,
    metadata: { user_id: i.userId },
  })
}

export function getAccount(id: string) {
  return call<WhopAccount>('GET', `/accounts/${encodeURIComponent(id)}`)
}

/**
 * Ready to be paid: identity approved on Whop and nothing left for the clipper to do. Whop has no single
 * "payouts enabled" flag; this is what its docs list (verification, capabilities, required_actions).
 */
export function accountReady(a: WhopAccount) {
  const kyc = a.verification?.individual?.status
  const transfer = a.capabilities?.transfer
  return kyc === 'approved' && (!transfer || transfer === 'active') && !(a.required_actions?.length ?? 0)
}

/** Whop's own page: identity check (account_onboarding) or the clipper's balance and cash out (payouts_portal). */
export function accountLink(accountId: string, useCase: 'account_onboarding' | 'payouts_portal') {
  const app = env().APP_URL.replace(/\/$/, '')
  return call<{ url: string; expires_at: string }>('POST', '/account_links', {
    account_id: accountId,
    use_case: useCase,
    return_url: `${app}/api/whop/return`,
    refresh_url: `${app}/api/whop/return?again=1`,
  })
}

export type WhopTransfer = { id: string; status: 'processing' | 'succeeded' | 'failed'; failure_reason?: string | null }

/** Pay a withdrawal: the net amount, in dollars as Whop takes it, from the company balance. */
export function createTransfer(i: { withdrawalId: string; destinationId: string; netCents: number }) {
  return call<WhopTransfer>('POST', '/transfers', {
    type: 'balance',
    origin_id: env().WHOP_COMPANY_ID,
    destination_id: i.destinationId,
    amount: Number((i.netCents / 100).toFixed(2)),
    currency: 'usd',
    idempotence_key: `withdrawal:${i.withdrawalId}`,
    notes: 'Maison d’Élites earnings',
    metadata: { withdrawal_id: i.withdrawalId },
  })
}

export function getTransfer(id: string) {
  return call<WhopTransfer>('GET', `/transfers/${encodeURIComponent(id)}`)
}

/**
 * Checks a webhook from Whop (Standard Webhooks): HMAC-SHA256 of "id.timestamp.body" with the ws_
 * secret, base64, in the webhook-signature header as "v1,<sig>" (several may be listed). Older than
 * five minutes is refused, so a captured request cannot be replayed.
 */
export function verifyWebhook(headers: Headers, body: string, now = Date.now()) {
  const secret = env().WHOP_WEBHOOK_SECRET
  const id = headers.get('webhook-id')
  const ts = headers.get('webhook-timestamp')
  const sigs = headers.get('webhook-signature')
  if (!secret || !id || !ts || !sigs) return false
  if (!/^\d+$/.test(ts) || Math.abs(now / 1000 - Number(ts)) > 300) return false
  const expected = createHmac('sha256', secret).update(`${id}.${ts}.${body}`).digest()
  return sigs.split(' ').some((s) => {
    const [v, b64] = s.split(',')
    if (v !== 'v1' || !b64) return false
    const got = Buffer.from(b64, 'base64')
    return got.length === expected.length && timingSafeEqual(got, expected)
  })
}
