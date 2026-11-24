import 'server-only'
import { db, notify, tables } from '@mde/db'
import {
  approveWithdrawal,
  createPgStore,
  markWithdrawalFailed,
  markWithdrawalPaid,
  markWithdrawalSent,
} from '@mde/money'
import { formatDollars } from '@mde/money/dollars'
import { eq } from 'drizzle-orm'
import { parseWhop } from '@/lib/crypto-wallets'
import { createTransfer, getTransfer, type WhopTransfer } from './whop'

// Paying withdrawals through Whop (owner, 2026-11-24). Staff verify a withdrawal as before; for a Whop
// payout account the platform then sends a Whop transfer of the net amount from the company balance.
// Whop's confirmation (webhook, or "Check with Whop" on the Payouts page) marks it paid or failed, through
// the same money engine steps as every other withdrawal. The transfer's idempotence key is the
// withdrawal id, so pressing the button twice never pays twice.

/** Verify (if needed) and send. Returns the transfer as Whop reported it. */
export async function payWithWhop(withdrawalId: string, actorId: string) {
  const d = db()
  const store = createPgStore(d)
  const [w] = await d.select().from(tables.withdrawals).where(eq(tables.withdrawals.id, withdrawalId))
  if (!w) throw new Error('No such withdrawal')
  const destinationId = parseWhop(w.destination)
  if (w.method !== 'whop' || !destinationId) throw new Error('This withdrawal is not a Whop payout')
  if (w.status === 'requested') await approveWithdrawal(store, { withdrawalId, actorId })
  const t = await createTransfer({ withdrawalId, destinationId, netCents: w.netCents })
  await markWithdrawalSent(store, { withdrawalId, partnerReference: t.id, actorId })
  await settleWhopTransfer(t)
  return t
}

/** Apply a transfer's final state to its withdrawal. Processing changes nothing. Safe to repeat. */
export async function settleWhopTransfer(t: Pick<WhopTransfer, 'id' | 'status' | 'failure_reason'>) {
  if (t.status === 'processing') return 'processing' as const
  const d = db()
  const [w] = await d.select().from(tables.withdrawals).where(eq(tables.withdrawals.partnerReference, t.id))
  if (!w || w.method !== 'whop') return 'unknown' as const
  const store = createPgStore(d)
  if (t.status === 'succeeded') {
    const r = await markWithdrawalPaid(store, { withdrawalId: w.id, partnerReference: t.id, actorId: null })
    if (!r.alreadyDone)
      await notify(d, w.creatorId, 'withdrawal_status', {
        title: 'Your withdrawal was sent',
        body: `${formatDollars(w.netCents)} is in your Whop balance. Cash it out from Whop to your bank, PayPal or crypto.`,
        link: '/wallet',
      })
    return 'paid' as const
  }
  const reason = `Whop could not pay it${t.failure_reason ? `: ${t.failure_reason}` : ''}`.slice(0, 200)
  const r = await markWithdrawalFailed(store, { withdrawalId: w.id, reason, actorId: null })
  if (!r.alreadyDone)
    await notify(d, w.creatorId, 'withdrawal_status', {
      title: 'Your withdrawal was returned to your balance',
      body: `${formatDollars(w.amountCents)} is back in your available balance. ${reason}.`,
      link: '/wallet',
    })
  return 'failed' as const
}

/** Ask Whop where a sent transfer is, for when its webhook has not arrived. */
export async function checkWhopTransfer(withdrawalId: string) {
  const [w] = await db().select().from(tables.withdrawals).where(eq(tables.withdrawals.id, withdrawalId))
  if (!w?.partnerReference || w.method !== 'whop') return 'unknown' as const
  return settleWhopTransfer(await getTransfer(w.partnerReference))
}
