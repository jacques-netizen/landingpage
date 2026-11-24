// Whop webhooks (owner, 2026-11-24: Whop payouts) are checked with the Standard Webhooks signature, so
// nobody but Whop can mark a withdrawal paid. Also the Whop payout account format.
import { createHmac } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { methodOf, parseWhop } from '@/lib/crypto-wallets'

const SECRET = 'ws_test_secret_123'
let verifyWebhook: typeof import('@/server/whop').verifyWebhook
let accountReady: typeof import('@/server/whop').accountReady

beforeAll(async () => {
  process.env.WHOP_WEBHOOK_SECRET = SECRET
  ;({ verifyWebhook, accountReady } = await import('@/server/whop'))
})

function signed(body: string, ts: number, id = 'msg_1', secret = SECRET) {
  const sig = createHmac('sha256', secret).update(`${id}.${ts}.${body}`).digest('base64')
  return new Headers({ 'webhook-id': id, 'webhook-timestamp': String(ts), 'webhook-signature': `v1,${sig}` })
}

describe('Whop webhooks', () => {
  const body = '{"type":"transfer.completed","data":{"id":"ctt_1"}}'
  const now = Date.now()
  const ts = Math.floor(now / 1000)

  it('accepts a correctly signed, fresh request', () => {
    expect(verifyWebhook(signed(body, ts), body, now)).toBe(true)
  })
  it('refuses a changed body, a wrong secret, a stale timestamp or no signature', () => {
    expect(verifyWebhook(signed(body, ts), body.replace('ctt_1', 'ctt_2'), now)).toBe(false)
    expect(verifyWebhook(signed(body, ts, 'msg_1', 'ws_other'), body, now)).toBe(false)
    expect(verifyWebhook(signed(body, ts - 600), body, now)).toBe(false)
    expect(verifyWebhook(new Headers(), body, now)).toBe(false)
  })
})

describe('Whop payout accounts', () => {
  it('reads the saved account and its method', () => {
    expect(parseWhop('whop:biz_abc123')).toBe('biz_abc123')
    expect(parseWhop('whop:biz_abc; drop')).toBeNull()
    expect(methodOf('whop:biz_abc123')).toBe('whop')
  })
  it('is ready only when Whop approved the ID check and nothing is left to do', () => {
    expect(accountReady({ id: 'biz_1', verification: { individual: { status: 'approved' } } })).toBe(true)
    expect(accountReady({ id: 'biz_1', verification: { individual: { status: 'pending' } } })).toBe(false)
    expect(
      accountReady({ id: 'biz_1', verification: { individual: { status: 'approved' } }, required_actions: [{}] }),
    ).toBe(false)
    expect(
      accountReady({
        id: 'biz_1',
        verification: { individual: { status: 'approved' } },
        capabilities: { transfer: 'pending' },
      }),
    ).toBe(false)
  })
})
