'use server'

import { db, tables } from '@mde/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { rateLimit } from '@/server/rate-limit'
import { getViewer } from '@/server/viewer'

export type PayoutMethodResult = { ok: true } | { ok: false; error: string; field?: 'name' | 'details' }

const input = z.discriminatedUnion('method', [
  z.object({ method: z.literal('paypal'), name: z.string(), details: z.string().trim().toLowerCase() }),
  z.object({ method: z.literal('bank_transfer'), name: z.string(), details: z.string() }),
])

/**
 * Saves the creator's payout method (testing report item 5). It only records where money should go;
 * no money moves here. Withdrawals stay closed until payouts are connected.
 */
export async function savePayoutMethodAction(raw: unknown): Promise<PayoutMethodResult> {
  const viewer = await getViewer()
  if (!viewer) return { ok: false, error: 'Sign in again to continue.' }
  if (!(await rateLimit(`payout-method:${viewer.id}`, 10, 3600)))
    return { ok: false, error: 'Too many changes. Wait an hour and try again.' }
  const parsed = input.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Choose PayPal or bank transfer.' }
  const { method } = parsed.data
  const name = parsed.data.name.trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 120)
    return { ok: false, field: 'name', error: 'Enter the full name on the account.' }
  let details: string
  if (method === 'paypal') {
    const email = z.email().safeParse(parsed.data.details)
    if (!email.success) return { ok: false, field: 'details', error: 'Enter your PayPal email, like name@example.com.' }
    details = email.data
  } else {
    details = parsed.data.details.replace(/[\s-]/g, '').toUpperCase()
    if (!/^[A-Z0-9]{6,34}$/.test(details))
      return { ok: false, field: 'details', error: 'Enter your IBAN or account number, letters and digits only.' }
  }
  await db()
    .insert(tables.creatorProfiles)
    .values({
      userId: viewer.id,
      payoutProvider: method,
      payoutProviderRef: `${name} | ${details}`,
      payoutStatus: 'pending',
    })
    .onConflictDoUpdate({
      target: tables.creatorProfiles.userId,
      set: {
        payoutProvider: method,
        payoutProviderRef: `${name} | ${details}`,
        payoutStatus: 'pending',
        updatedAt: new Date(),
      },
    })
  revalidatePath('/wallet')
  return { ok: true }
}
