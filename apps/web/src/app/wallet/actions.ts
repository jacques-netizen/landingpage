'use server'

import { db, tables } from '@mde/db'
import { createPgStore, MoneyError, requestWithdrawal } from '@mde/money'
import { parseDollarsToCents } from '@mde/money/dollars'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { walletDestination } from '@/lib/crypto-wallets'
import { rateLimit } from '@/server/rate-limit'
import { getViewer } from '@/server/viewer'

export type PayoutMethodResult = { ok: true } | { ok: false; error: string; field?: 'wallet' | 'address' }

/**
 * Saves the crypto wallet withdrawals are sent to (owner request, 2026-10-08). It only records where
 * money should go; no money moves here. The address is checked against the network's format.
 */
export async function savePayoutMethodAction(raw: { wallet?: string; address?: string }): Promise<PayoutMethodResult> {
  const viewer = await getViewer()
  if (!viewer) return { ok: false, error: 'Sign in again to continue.' }
  if (!(await rateLimit(`payout-method:${viewer.id}`, 10, 3600)))
    return { ok: false, error: 'Too many changes. Wait an hour and try again.' }
  if (!raw.wallet) return { ok: false, field: 'wallet', error: 'Choose the coin and network.' }
  const destination = walletDestination(raw.wallet, raw.address ?? '')
  if (!destination)
    return {
      ok: false,
      field: 'address',
      error: 'That is not an address on this network. Copy it from your wallet app, for this exact coin and network.',
    }
  // A valid wallet is all a withdrawal needs: staff verify each withdrawal before sending it.
  const values = { payoutProvider: 'crypto', payoutProviderRef: destination, payoutStatus: 'verified' }
  await db()
    .insert(tables.creatorProfiles)
    .values({ userId: viewer.id, ...values })
    .onConflictDoUpdate({ target: tables.creatorProfiles.userId, set: { ...values, updatedAt: new Date() } })
  revalidatePath('/wallet')
  return { ok: true }
}

export type WithdrawResult = { ok: true; netCents: number } | { ok: false; error: string }

const MESSAGES: Partial<Record<string, string>> = {
  payout_not_verified: 'Add the wallet to send it to first.',
  creator_suspended: 'Your account cannot withdraw right now. Contact support.',
  withdrawal_already_requested: 'You already have a withdrawal being processed. Wait for it to finish.',
  insufficient_available: 'That is more than your available balance.',
}

/** Ask to withdraw available earnings to the saved crypto wallet. Staff verify and send it. */
export async function requestWithdrawalAction(raw: { amount?: string }): Promise<WithdrawResult> {
  const viewer = await getViewer()
  if (!viewer) return { ok: false, error: 'Sign in again to continue.' }
  if (!(await rateLimit(`withdraw:${viewer.id}`, 10, 3600)))
    return { ok: false, error: 'Too many attempts. Wait an hour and try again.' }
  const parsed = parseDollarsToCents(raw.amount ?? '')
  if (!parsed.ok) return { ok: false, error: 'Enter an amount in dollars, like 50 or 50.25.' }
  const [p] = await db()
    .select({ provider: tables.creatorProfiles.payoutProvider, ref: tables.creatorProfiles.payoutProviderRef })
    .from(tables.creatorProfiles)
    .where(eq(tables.creatorProfiles.userId, viewer.id))
  if (p?.provider !== 'crypto' || !p.ref) return { ok: false, error: MESSAGES.payout_not_verified! }
  try {
    const w = await requestWithdrawal(createPgStore(db()), {
      creatorId: viewer.id,
      amountCents: parsed.cents,
      method: 'crypto',
      destination: p.ref,
    })
    revalidatePath('/wallet')
    return { ok: true, netCents: w.netCents }
  } catch (e) {
    if (e instanceof MoneyError) return { ok: false, error: MESSAGES[e.code] ?? e.message }
    throw e
  }
}
