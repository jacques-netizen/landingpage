import { and, eq, ne, sql } from 'drizzle-orm'
import { campaigns, ledgerTransactions, reviewDecisions, submissions, type Database } from '@mde/db'
import { computePostEarnings } from '../earnings'
import { accounts, balanceOf, lockAccounts } from './accounts'
import { auditIfStaff } from './audit'
import { postTransaction } from './post'

export type ApplyEarningsResult = {
  submissionId: string
  countedViews: number
  earnedCents: bigint
  deltaCents: bigint
  transactionId: string | null
  /** True when the budget is used up and the campaign is closing. */
  campaignClosing: boolean
}

const EARNING_STATES = ['approved', 'earning']

/**
 * Runs the earnings engine for one submission (docs/02 section 5). The post total is recomputed from
 * counted views and only the difference is posted, so running it twice changes nothing.
 * Accounts are locked first, in a fixed order, so parallel jobs on one campaign never overspend it.
 */
export async function applyEarnings(
  db: Database,
  submissionId: string,
): Promise<ApplyEarningsResult> {
  return db.transaction(async (tx) => {
    const [first] = await tx
      .select({ campaignId: submissions.campaignId, creatorId: submissions.creatorId })
      .from(submissions)
      .where(eq(submissions.id, submissionId))
      .limit(1)
    if (!first) throw new Error('No such submission')

    const [budgetAcc, pendingAcc] = await Promise.all([
      accounts.campaignBudget(tx, first.campaignId),
      accounts.creatorPending(tx, first.creatorId),
    ])
    await lockAccounts(tx, [budgetAcc, pendingAcc])

    const [sub] = await tx
      .select()
      .from(submissions)
      .where(eq(submissions.id, submissionId))
      .for('update')
    if (!sub) throw new Error('No such submission')
    const [campaign] = await tx
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, sub.campaignId))
      .limit(1)
    if (!campaign) throw new Error('No such campaign')

    const unchanged: ApplyEarningsResult = {
      submissionId,
      countedViews: sub.countedViews,
      earnedCents: sub.earnedCents,
      deltaCents: 0n,
      transactionId: null,
      campaignClosing: campaign.status === 'closing' || campaign.status === 'closed',
    }
    // Views only count while a post is approved or earning.
    if (!EARNING_STATES.includes(sub.state)) return unchanged

    const countedViews = Math.max(0, sub.latestViews - sub.baselineViews)

    const [others] = await tx
      .select({ total: sql<string>`coalesce(sum(${submissions.earnedCents}), 0)::text` })
      .from(submissions)
      .where(
        and(
          eq(submissions.campaignId, sub.campaignId),
          eq(submissions.creatorId, sub.creatorId),
          ne(submissions.id, sub.id),
        ),
      )

    const budgetBalance = await balanceOf(tx, budgetAcc)
    const result = computePostEarnings({
      countedViews,
      rateCentsPer1000: sub.rateCentsPer1000Locked,
      minViewsToEarn: campaign.minViewsToEarn,
      capPerPostCents: campaign.capPerPostCents,
      capPerCreatorCents: campaign.capPerCreatorCents,
      creatorEarnedElsewhereCents: BigInt(others?.total ?? '0'),
      budgetBalanceCents: budgetBalance,
      alreadyEarnedCents: sub.earnedCents,
      acceptingNewEarnings: campaign.status === 'live',
    })

    let transactionId: string | null = null
    if (result.deltaCents !== 0n) {
      // The key includes how many movements this post has had, so a post that goes down and back up
      // to the same views is paid again instead of colliding with its earlier key.
      const [seq] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(ledgerTransactions)
        .where(eq(ledgerTransactions.submissionId, sub.id))
      const step = seq?.n ?? 0
      const abs = result.deltaCents < 0n ? -result.deltaCents : result.deltaCents
      const accrue = result.deltaCents > 0n
      const res = await postTransaction(tx, {
        kind: accrue ? 'earning_accrued' : 'earning_reversed',
        idempotencyKey: `${accrue ? 'earning' : 'earning_reversed'}:${sub.id}:${countedViews}:${step}`,
        entries: accrue
          ? [
              { accountId: budgetAcc, amountCents: -abs },
              { accountId: pendingAcc, amountCents: abs },
            ]
          : [
              { accountId: pendingAcc, amountCents: -abs },
              { accountId: budgetAcc, amountCents: abs },
            ],
        campaignId: sub.campaignId,
        submissionId: sub.id,
        creatorId: sub.creatorId,
      })
      // If the key already existed the ledger and the submission would disagree. Never continue.
      if (!res.created) throw new Error(`Earning movement ${sub.id} step ${step} already exists`)
      transactionId = res.transactionId
    }

    const earning = countedViews > 0 && countedViews >= (campaign.minViewsToEarn ?? 0)
    await tx
      .update(submissions)
      .set({ countedViews, earnedCents: result.postCents, state: earning ? 'earning' : 'approved' })
      .where(eq(submissions.id, sub.id))

    let campaignClosing = unchanged.campaignClosing
    if (campaign.status === 'live' && result.budgetAfterCents <= 0n) {
      await tx.update(campaigns).set({ status: 'closing' }).where(eq(campaigns.id, campaign.id))
      campaignClosing = true
    }

    return {
      submissionId,
      countedViews,
      earnedCents: result.postCents,
      deltaCents: result.deltaCents,
      transactionId,
      campaignClosing,
    }
  })
}

export type ReverseInput = {
  submissionId: string
  toState: 'rejected' | 'removed'
  outcome: 'reject' | 'remove'
  reasonCode: string
  note?: string
  /** The reviewer. Only the system may remove a post without one (the deleted post rule). */
  actorId: string | null
}

/**
 * A reviewer rejects, or the system removes, a post. Everything it earned is taken back from the
 * creator's pending balance and returned to the campaign budget, exactly (docs/02 section 5.5).
 */
export async function reverseEarnings(db: Database, input: ReverseInput) {
  if ((input.outcome === 'reject') !== (input.toState === 'rejected'))
    throw new Error('Outcome and state do not match')
  if (input.outcome === 'reject' && !input.actorId)
    throw new Error('A rejection needs an actor, the reviewer who decided')

  return db.transaction(async (tx) => {
    const [first] = await tx
      .select({ campaignId: submissions.campaignId, creatorId: submissions.creatorId })
      .from(submissions)
      .where(eq(submissions.id, input.submissionId))
      .limit(1)
    if (!first) throw new Error('No such submission')
    const [budgetAcc, pendingAcc] = await Promise.all([
      accounts.campaignBudget(tx, first.campaignId),
      accounts.creatorPending(tx, first.creatorId),
    ])
    await lockAccounts(tx, [budgetAcc, pendingAcc])

    const [sub] = await tx
      .select()
      .from(submissions)
      .where(eq(submissions.id, input.submissionId))
      .for('update')
    if (!sub) throw new Error('No such submission')
    if (sub.state === input.toState) return { reversedCents: 0n, changed: false }
    if (sub.state === 'paid_out') {
      throw new Error(
        'Earnings were already released. They are not taken back automatically, finance decides',
      )
    }

    const [decision] = await tx
      .insert(reviewDecisions)
      .values({
        submissionId: sub.id,
        reviewerId: input.actorId,
        outcome: input.outcome,
        reasonCode: input.reasonCode,
        note: input.note,
      })
      .returning({ id: reviewDecisions.id })

    const reversed = sub.earnedCents
    if (reversed > 0n) {
      await postTransaction(tx, {
        kind: 'earning_reversed',
        idempotencyKey: `reversal:${sub.id}:${decision!.id}`,
        entries: [
          { accountId: pendingAcc, amountCents: -reversed },
          { accountId: budgetAcc, amountCents: reversed },
        ],
        campaignId: sub.campaignId,
        submissionId: sub.id,
        creatorId: sub.creatorId,
        createdBy: input.actorId,
        memo: input.reasonCode,
      })
    }
    await tx
      .update(submissions)
      .set({
        state: input.toState,
        reasonCode: input.reasonCode,
        reasonNote: input.note ?? null,
        earnedCents: 0n,
      })
      .where(eq(submissions.id, sub.id))

    await auditIfStaff(tx, input.actorId, {
      action: `submission.${input.outcome}`,
      entity: 'submission',
      entityId: sub.id,
      before: { state: sub.state, earnedCents: sub.earnedCents.toString() },
      after: {
        state: input.toState,
        reasonCode: input.reasonCode,
        reversedCents: reversed.toString(),
      },
    })
    return { reversedCents: reversed, changed: true }
  })
}
