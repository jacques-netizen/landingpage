'use server'

import { db, notify } from '@mde/db'
import { approveWithdrawal, createPgStore, markWithdrawalFailed, markWithdrawalPaid, MoneyError } from '@mde/money'
import { formatDollars } from '@mde/money/dollars'
import { tables } from '@mde/db'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { explorerLink, validTransaction } from '@/lib/crypto-wallets'
import { requireStaff } from '@/server/guard'

export type PayoutState = { ok?: string; error?: string }

// Finance and admins work through crypto withdrawals: verify, send from the company wallet, then mark
// paid with the transaction hash; or reject, which returns the money to the creator. Each step is
// audited by the money engine and the creator is notified.
export async function payoutAction(id: string, _prev: PayoutState, form: FormData): Promise<PayoutState> {
  const viewer = await requireStaff('money', '/admin/payouts')
  const what = String(form.get('action') ?? '')
  const d = db()
  const [w] = await d.select().from(tables.withdrawals).where(eq(tables.withdrawals.id, id))
  if (!w) return { error: 'No such withdrawal.' }
  const store = createPgStore(d)
  const amount = formatDollars(w.netCents)
  try {
    if (what === 'approve') {
      await approveWithdrawal(store, { withdrawalId: id, actorId: viewer.id })
      await notify(d, w.creatorId, 'withdrawal_status', {
        title: 'Your withdrawal is verified',
        body: `We verified your withdrawal of ${formatDollars(w.amountCents)} and are sending ${amount} to your wallet.`,
        link: '/wallet',
      })
      revalidatePath('/admin/payouts')
      return { ok: 'Verified. Send it from the company wallet, then mark it paid.' }
    }
    if (what === 'paid') {
      const hash = String(form.get('hash') ?? '').trim()
      if (!w.destination || !validTransaction(w.destination, hash))
        return { error: 'Paste the transaction hash from the network this wallet is on.' }
      await markWithdrawalPaid(store, { withdrawalId: id, partnerReference: hash, actorId: viewer.id })
      await notify(d, w.creatorId, 'withdrawal_status', {
        title: 'Your withdrawal was sent',
        body: `${amount} in stablecoins is on its way to your wallet. It can take a few minutes to arrive.`,
        link: explorerLink(w.destination, hash) ?? '/wallet',
      })
      revalidatePath('/admin/payouts')
      return { ok: 'Marked paid. The creator was told.' }
    }
    if (what === 'reject') {
      const reason = String(form.get('reason') ?? '').trim()
      if (reason.length < 3) return { error: 'Say why, so the creator can fix it.' }
      await markWithdrawalFailed(store, { withdrawalId: id, reason: reason.slice(0, 200), actorId: viewer.id })
      await notify(d, w.creatorId, 'withdrawal_status', {
        title: 'Your withdrawal was returned to your balance',
        body: `${formatDollars(w.amountCents)} is back in your available balance. Reason: ${reason.slice(0, 200)}`,
        link: '/wallet',
      })
      revalidatePath('/admin/payouts')
      return { ok: 'Rejected. The amount is back in the creator’s available balance.' }
    }
  } catch (e) {
    if (e instanceof MoneyError) return { error: e.message }
    throw e
  }
  return { error: 'Unknown action.' }
}
