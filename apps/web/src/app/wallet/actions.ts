'use server'

import { db, tables } from '@mde/db'
import { createPgStore, MoneyError, requestWithdrawal } from '@mde/money'
import { parseDollarsToCents } from '@mde/money/dollars'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { bankDestination, methodOf, walletDestination } from '@/lib/crypto-wallets'
import { rateLimit } from '@/server/rate-limit'
import { getViewer } from '@/server/viewer'

export type PayoutField = 'coin' | 'network' | 'address' | 'country' | 'bankName' | 'accountNumber' | 'name'
export type PayoutMethodResult = { ok: true } | { ok: false; error: string; field?: PayoutField }

export type PayoutMethodInput =
  | { method: 'crypto'; coin?: string; network?: string; address?: string }
  | { method: 'bank'; country?: string; bankName?: string; accountNumber?: string; name?: string }

const BANK_ERRORS: Record<string, string> = {
  country: 'Choose the country your bank is in.',
  bankName: 'Enter the name of your bank.',
  accountNumber: 'Enter your account number or IBAN, letters and digits only.',
  name: 'Enter the name on the account, as the bank has it.',
}

/**
 * Saves where withdrawals are paid: a crypto wallet or a bank account (owner requests, 2026-10-08).
 * It only records where money should go; no money moves here.
 */
export async function savePayoutMethodAction(raw: PayoutMethodInput): Promise<PayoutMethodResult> {
  const viewer = await getViewer()
  if (!viewer) return { ok: false, error: 'Sign in again to continue.' }
  if (!(await rateLimit(`payout-method:${viewer.id}`, 10, 3600)))
    return { ok: false, error: 'Too many changes. Wait an hour and try again.' }
  let destination: string
  let provider: 'crypto' | 'bank_transfer'
  if (raw.method === 'crypto') {
    if (!raw.coin) return { ok: false, field: 'coin', error: 'Choose the crypto.' }
    if (!raw.network) return { ok: false, field: 'network', error: 'Choose the network.' }
    const d = walletDestination(`${raw.coin}|${raw.network}`, raw.address ?? '')
    if (!d)
      return {
        ok: false,
        field: 'address',
        error:
          'That is not an address on this network. Copy it from your wallet app, for this exact crypto and network.',
      }
    destination = d
    provider = 'crypto'
  } else {
    const b = bankDestination({
      country: raw.country ?? '',
      bankName: raw.bankName ?? '',
      accountNumber: raw.accountNumber ?? '',
      name: raw.name ?? '',
    })
    if (!b.ok) return { ok: false, field: b.field, error: BANK_ERRORS[b.field]! }
    destination = b.destination
    provider = 'bank_transfer'
  }
  // Valid details are all a withdrawal needs: staff verify each withdrawal before paying it.
  const values = { payoutProvider: provider, payoutProviderRef: destination, payoutStatus: 'verified' }
  await db()
    .insert(tables.creatorProfiles)
    .values({ userId: viewer.id, ...values })
    .onConflictDoUpdate({ target: tables.creatorProfiles.userId, set: { ...values, updatedAt: new Date() } })
  revalidatePath('/wallet')
  return { ok: true }
}

export type WithdrawResult = { ok: true; netCents: number } | { ok: false; error: string }

const MESSAGES: Partial<Record<string, string>> = {
  payout_not_verified: 'Add your payout method first.',
  creator_suspended: 'Your account cannot withdraw right now. Contact support.',
  withdrawal_already_requested: 'You already have a withdrawal being processed. Wait for it to finish.',
  insufficient_available: 'That is more than your available balance.',
}

/** Ask to withdraw available earnings to the saved wallet or bank account. Staff verify and pay it. */
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
  const method = methodOf(p?.ref)
  if (!method || !p?.ref) return { ok: false, error: MESSAGES.payout_not_verified! }
  try {
    const w = await requestWithdrawal(createPgStore(db()), {
      creatorId: viewer.id,
      amountCents: parsed.cents,
      method,
      destination: p.ref,
    })
    revalidatePath('/wallet')
    return { ok: true, netCents: w.netCents }
  } catch (e) {
    if (e instanceof MoneyError) return { ok: false, error: MESSAGES[e.code] ?? e.message }
    throw e
  }
}
