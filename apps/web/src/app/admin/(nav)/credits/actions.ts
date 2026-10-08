'use server'

import { db, notify, tables } from '@mde/db'
import { createPgStore, manualAdjustment, MoneyError } from '@mde/money'
import { formatDollars, parseDollarsToCents } from '@mde/money/dollars'
import { sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { requireStaff } from '@/server/guard'

export type CreditState = { ok?: string; error?: string; field?: 'user' | 'amount' | 'reason' }

const MAX_CENTS = 10_000_000 // $100,000 in one credit, a guard against a typo

/**
 * Credit any user's balance (owner request, 2026-10-08). The money is new to the platform, so it comes
 * in from outside and lands in the user's available balance, ready to withdraw. Recorded as an audited
 * manual adjustment in the ledger with the reason, and the user is told.
 */
export async function creditUserAction(_prev: CreditState, form: FormData): Promise<CreditState> {
  const viewer = await requireStaff('admin', '/admin/credits')
  const who = String(form.get('user') ?? '')
    .trim()
    .replace(/^@/, '')
  const reason = String(form.get('reason') ?? '').trim()
  const key = String(form.get('key') ?? '')
  if (!who) return { field: 'user', error: 'Enter the username or email of the person to credit.' }
  const amount = parseDollarsToCents(String(form.get('amount') ?? ''))
  if (!amount.ok || amount.cents <= 0)
    return { field: 'amount', error: 'Enter an amount in dollars, like 25 or 25.50.' }
  if (amount.cents > MAX_CENTS) return { field: 'amount', error: 'That is more than $100,000. Check the amount.' }
  if (reason.length < 3) return { field: 'reason', error: 'Say why, so the books and the person know.' }
  if (!/^[0-9a-f-]{36}$/.test(key)) return { error: 'Reload the page and try again.' }
  const d = db()
  const [u] = await d.execute<{ id: string; label: string }>(
    who.includes('@')
      ? sql`select id, coalesce('@' || username, email) as label from users where email = ${who.toLowerCase()}`
      : sql`select id, coalesce('@' || username, email) as label from users where username = ${who.toLowerCase()}`,
  )
  if (!u) return { field: 'user', error: 'No one has that username or email.' }
  try {
    const r = await manualAdjustment(createPgStore(d), {
      from: { kind: 'external', ownerType: 'platform', ownerId: null },
      to: { kind: 'creator_available', ownerType: 'creator', ownerId: u.id },
      amountCents: amount.cents,
      memo: `Credit: ${reason.slice(0, 300)}`,
      actorId: viewer.id,
      idempotencyKey: `credit:${key}`,
    })
    if (r.created) {
      await d.insert(tables.creatorProfiles).values({ userId: u.id }).onConflictDoNothing()
      await notify(d, u.id, 'withdrawal_status', {
        title: `You received ${formatDollars(amount.cents)}`,
        body: `${formatDollars(amount.cents)} was added to your available balance. ${reason.slice(0, 300)}`,
        link: '/wallet',
      })
    }
  } catch (e) {
    if (e instanceof MoneyError) return { error: e.message }
    throw e
  }
  revalidatePath('/admin/credits')
  return { ok: `Credited ${formatDollars(amount.cents)} to ${u.label}. It is in their available balance now.` }
}
