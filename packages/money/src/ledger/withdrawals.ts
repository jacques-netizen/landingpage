import { and, eq } from 'drizzle-orm'
import { creatorProfiles, getSettings, users, withdrawals, type Database } from '@mde/db'
import { formatUsd } from '../format'
import { withdrawalQuote } from '../fees'
import { accounts, balanceOf, lockAccounts } from './accounts'
import { auditIfStaff } from './audit'
import { postTransaction } from './post'

export type WithdrawalMethod = 'stripe_connect' | 'paypal'

/**
 * A creator asks to withdraw (docs/02 section 6). The fee is worked out now and shown before confirming,
 * but only taken when the partner confirms payment. Money moves to payout_in_transit straight away.
 */
export async function requestWithdrawal(
  db: Database,
  input: { creatorId: string; amountCents: bigint; method: WithdrawalMethod },
) {
  return db.transaction(async (tx) => {
    const [available, inTransit] = await Promise.all([
      accounts.creatorAvailable(tx, input.creatorId),
      accounts.payoutInTransit(tx),
    ])
    await lockAccounts(tx, [available, inTransit])

    const [user] = await tx
      .select({ status: users.status })
      .from(users)
      .where(eq(users.id, input.creatorId))
      .limit(1)
    if (!user) throw new Error('No such creator')
    if (user.status !== 'active') throw new Error('This account cannot withdraw right now')
    const [profile] = await tx
      .select({ payoutStatus: creatorProfiles.payoutStatus })
      .from(creatorProfiles)
      .where(eq(creatorProfiles.userId, input.creatorId))
      .limit(1)
    if (profile?.payoutStatus !== 'verified')
      throw new Error('Your payout details need to be verified before you can withdraw')

    const settings = await getSettings(tx)
    const minimum = BigInt(settings.withdrawal_min_cents)
    if (input.amountCents < minimum) {
      throw new Error(`The minimum withdrawal is ${formatUsd(minimum)}`)
    }
    const open = await tx
      .select({ id: withdrawals.id })
      .from(withdrawals)
      .where(and(eq(withdrawals.creatorId, input.creatorId), eq(withdrawals.status, 'requested')))
      .limit(1)
    if (open[0]) throw new Error('You already have an open withdrawal request')
    if ((await balanceOf(tx, available)) < input.amountCents)
      throw new Error('You do not have that much available')

    const quote = withdrawalQuote(input.amountCents, {
      feeBps: settings.withdrawal_fee_bps,
      feeMinCents: settings.withdrawal_fee_min_cents,
    })
    const [row] = await tx
      .insert(withdrawals)
      .values({
        creatorId: input.creatorId,
        method: input.method,
        amountCents: quote.amountCents,
        feeCents: quote.feeCents,
        netCents: quote.netCents,
      })
      .returning()
    await postTransaction(tx, {
      kind: 'withdrawal_requested',
      idempotencyKey: `withdrawal_requested:${row!.id}`,
      entries: [
        { accountId: available, amountCents: -quote.amountCents },
        { accountId: inTransit, amountCents: quote.amountCents },
      ],
      creatorId: input.creatorId,
      payoutId: row!.id,
    })
    return row!
  })
}

type Open = 'requested' | 'approved' | 'in_batch'

async function loadForUpdate(
  tx: Parameters<Parameters<Database['transaction']>[0]>[0],
  withdrawalId: string,
) {
  const [row] = await tx
    .select()
    .from(withdrawals)
    .where(eq(withdrawals.id, withdrawalId))
    .for('update')
  if (!row) throw new Error('No such withdrawal')
  return row
}

/** The batch has been sent to the partner. */
export async function markWithdrawalSent(
  db: Database,
  input: { withdrawalId: string; actorId?: string | null },
) {
  return db.transaction(async (tx) => {
    const row = await loadForUpdate(tx, input.withdrawalId)
    if (row.status === 'sent') return row
    if (!(['requested', 'approved', 'in_batch'] as Open[]).includes(row.status as Open)) {
      throw new Error(`A ${row.status} withdrawal cannot be sent`)
    }
    const [updated] = await tx
      .update(withdrawals)
      .set({ status: 'sent' })
      .where(eq(withdrawals.id, row.id))
      .returning()
    await auditIfStaff(tx, input.actorId, {
      action: 'withdrawal.send',
      entity: 'withdrawal',
      entityId: row.id,
      before: { status: row.status },
      after: { status: 'sent' },
    })
    return updated!
  })
}

/** The partner confirms payment. The fee is taken now, in the same transaction. Repeats do nothing. */
export async function markWithdrawalPaid(
  db: Database,
  input: { withdrawalId: string; partnerReference?: string; actorId?: string | null },
) {
  return db.transaction(async (tx) => {
    const first = await loadForUpdate(tx, input.withdrawalId)
    if (first.status === 'paid') return first
    if (first.status !== 'sent')
      throw new Error(`A ${first.status} withdrawal cannot be marked paid`)
    const [inTransit, external, revenue] = await Promise.all([
      accounts.payoutInTransit(tx),
      accounts.external(tx),
      accounts.platformRevenue(tx),
    ])
    await lockAccounts(tx, [inTransit, external, revenue])
    await postTransaction(tx, {
      kind: 'withdrawal_paid',
      idempotencyKey: `withdrawal_paid:${first.id}`,
      entries: [
        { accountId: inTransit, amountCents: -first.amountCents },
        { accountId: external, amountCents: first.netCents },
        ...(first.feeCents > 0n ? [{ accountId: revenue, amountCents: first.feeCents }] : []),
      ],
      creatorId: first.creatorId,
      payoutId: first.id,
    })
    const [updated] = await tx
      .update(withdrawals)
      .set({ status: 'paid', partnerReference: input.partnerReference ?? first.partnerReference })
      .where(eq(withdrawals.id, first.id))
      .returning()
    await auditIfStaff(tx, input.actorId, {
      action: 'withdrawal.paid',
      entity: 'withdrawal',
      entityId: first.id,
      before: { status: first.status },
      after: {
        status: 'paid',
        netCents: first.netCents.toString(),
        feeCents: first.feeCents.toString(),
      },
    })
    return updated!
  })
}

/** The partner failed the payout. The creator gets the whole amount back and no fee is taken. */
export async function markWithdrawalFailed(
  db: Database,
  input: { withdrawalId: string; reason: string; actorId?: string | null },
) {
  return db.transaction(async (tx) => {
    const first = await loadForUpdate(tx, input.withdrawalId)
    if (first.status === 'failed') return first
    if (first.status === 'paid' || first.status === 'cancelled')
      throw new Error(`A ${first.status} withdrawal cannot fail`)
    const [inTransit, available] = await Promise.all([
      accounts.payoutInTransit(tx),
      accounts.creatorAvailable(tx, first.creatorId),
    ])
    await lockAccounts(tx, [inTransit, available])
    await postTransaction(tx, {
      kind: 'withdrawal_failed',
      idempotencyKey: `withdrawal_failed:${first.id}`,
      entries: [
        { accountId: inTransit, amountCents: -first.amountCents },
        { accountId: available, amountCents: first.amountCents },
      ],
      creatorId: first.creatorId,
      payoutId: first.id,
      memo: input.reason,
    })
    const [updated] = await tx
      .update(withdrawals)
      .set({ status: 'failed', failureReason: input.reason })
      .where(eq(withdrawals.id, first.id))
      .returning()
    await auditIfStaff(tx, input.actorId, {
      action: 'withdrawal.failed',
      entity: 'withdrawal',
      entityId: first.id,
      before: { status: first.status },
      after: { status: 'failed', reason: input.reason },
    })
    return updated!
  })
}
