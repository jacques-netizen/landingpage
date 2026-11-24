import { NextResponse, type NextRequest } from 'next/server'
import { verifyWebhook } from '@/server/whop'
import { settleWhopTransfer } from '@/server/whop-payouts'

// Whop tells us a transfer finished (owner, 2026-11-24: Whop payouts). Signed with the webhook secret
// (Standard Webhooks); anything unsigned, stale or tampered with is refused. Whop retries on any
// non-2xx, and settling a withdrawal twice changes nothing, so retries are safe.
export async function POST(req: NextRequest) {
  const body = await req.text()
  if (body.length > 256_000 || !verifyWebhook(req.headers, body))
    return NextResponse.json(
      { error: { code: 'bad_signature', message: 'Not a valid Whop webhook.' } },
      { status: 401 },
    )
  let event: { type?: string; data?: { id?: string; status?: string; failure_reason?: string | null } }
  try {
    event = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: { code: 'bad_body', message: 'Not JSON.' } }, { status: 400 })
  }
  const t = event.data
  if ((event.type === 'transfer.completed' || event.type === 'transfer.failed') && t?.id) {
    await settleWhopTransfer({
      id: t.id,
      status: event.type === 'transfer.completed' ? 'succeeded' : 'failed',
      failure_reason: t.failure_reason ?? null,
    })
  }
  return NextResponse.json({ ok: true })
}
