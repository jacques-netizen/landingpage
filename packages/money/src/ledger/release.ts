import { eq, sql } from 'drizzle-orm'
import { submissions, users, type Database } from '@mde/db'
import { accounts, lockAccounts } from './accounts'
import { postTransaction } from './post'

export type ReleaseResult = {
  released: boolean
  reason?: 'not_final' | 'open_flag' | 'open_appeal' | 'creator_suspended'
  releasedCents: bigint
}

/**
 * After the review window, moves one post's earnings from pending to available (docs/02 section 5.4).
 * Waits while a fraud flag or an appeal is open, and for suspended creators (finance decides those).
 */
export async function releaseEarnings(db: Database, submissionId: string): Promise<ReleaseResult> {
  return db.transaction(async (tx) => {
    const [first] = await tx
      .select({ creatorId: submissions.creatorId })
      .from(submissions)
      .where(eq(submissions.id, submissionId))
      .limit(1)
    if (!first) throw new Error('No such submission')
    const [pendingAcc, availableAcc] = await Promise.all([
      accounts.creatorPending(tx, first.creatorId),
      accounts.creatorAvailable(tx, first.creatorId),
    ])
    await lockAccounts(tx, [pendingAcc, availableAcc])

    const [sub] = await tx
      .select()
      .from(submissions)
      .where(eq(submissions.id, submissionId))
      .for('update')
    if (!sub || sub.state !== 'final')
      return { released: false, reason: 'not_final', releasedCents: 0n }

    const [creator] = await tx
      .select({ status: users.status })
      .from(users)
      .where(eq(users.id, sub.creatorId))
      .limit(1)
    if (creator?.status === 'suspended')
      return { released: false, reason: 'creator_suspended', releasedCents: 0n }

    const flags = await tx.execute<{ n: number }>(
      sql`select count(*)::int as n from fraud_flags where submission_id = ${sub.id} and status = 'open'`,
    )
    if ((flags[0]?.n ?? 0) > 0) return { released: false, reason: 'open_flag', releasedCents: 0n }
    const appeals = await tx.execute<{ n: number }>(
      sql`select count(*)::int as n from appeals where submission_id = ${sub.id} and status = 'open'`,
    )
    if ((appeals[0]?.n ?? 0) > 0)
      return { released: false, reason: 'open_appeal', releasedCents: 0n }

    const earned = sub.earnedCents
    if (earned > 0n) {
      await postTransaction(tx, {
        kind: 'earnings_released',
        idempotencyKey: `release:${sub.id}`,
        entries: [
          { accountId: pendingAcc, amountCents: -earned },
          { accountId: availableAcc, amountCents: earned },
        ],
        campaignId: sub.campaignId,
        submissionId: sub.id,
        creatorId: sub.creatorId,
      })
    }
    await tx.update(submissions).set({ state: 'paid_out' }).where(eq(submissions.id, sub.id))
    return { released: true, releasedCents: earned }
  })
}
