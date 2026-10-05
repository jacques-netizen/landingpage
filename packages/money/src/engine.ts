// The money engine: every movement of money is a balanced ledger transaction (02_DATA_AND_MONEY.md
// sections 3 to 6). Each operation runs in one database transaction with row locks on the accounts it
// touches. Lock order is always: campaign budget, then submission or withdrawal row, then creator and
// platform accounts, so two operations can never deadlock each other.
import { postEarnings } from './earnings'
import { MoneyError } from './errors'
import { serviceFeeCents, withdrawalQuote } from './fees'
import { assertWhole } from './math'
import {
  account,
  GUARDED_KINDS,
  type AccountRef,
  type Entry,
  type MoneyStore,
  type MoneyTx,
  type NewTransaction,
} from './store'

/** Post a balanced transaction. Zero entries are dropped; the rest must sum to zero. */
async function post(tx: MoneyTx, t: NewTransaction, legs: { id: string; amountCents: number }[]) {
  const entries: Entry[] = legs
    .filter((l) => l.amountCents !== 0)
    .map((l) => ({ accountId: l.id, amountCents: l.amountCents }))
  for (const e of entries) assertWhole(e.amountCents, 'Entry')
  if (entries.reduce((s, e) => s + e.amountCents, 0) !== 0) throw new Error(`Unbalanced ${t.kind} transaction`)
  if (entries.length < 2) throw new Error(`A ${t.kind} transaction needs at least two entries`)
  return tx.insertTransaction(t, entries)
}

// ---------- Client funding ----------

/** Client money arrives by invoice or bank transfer and is recorded by finance. */
export async function recordClientFunding(
  store: MoneyStore,
  i: { clientId: string; amountCents: number; reference: string; actorId: string | null },
) {
  assertWhole(i.amountCents, 'Amount')
  if (i.amountCents <= 0) throw new MoneyError('not_whole_cents', 'Funding must be more than zero')
  return store.transaction(async (tx) => {
    if ((await tx.clientServiceFeeBps(i.clientId)) === null) throw new MoneyError('not_found', 'No such client')
    const [ext, hold] = await tx.lockAccounts([account.external(), account.holding(i.clientId)])
    const r = await post(
      tx,
      {
        kind: 'client_funding_received',
        idempotencyKey: `funding:${i.clientId}:${i.reference}`,
        memo: i.reference,
        createdBy: i.actorId,
      },
      [
        { id: ext!, amountCents: -i.amountCents },
        { id: hold!, amountCents: i.amountCents },
      ],
    )
    if (r.created && i.actorId)
      await tx.audit({
        actorId: i.actorId,
        action: 'funding.record',
        entity: 'client',
        entityId: i.clientId,
        after: { amountCents: i.amountCents, reference: i.reference },
      })
    return r
  })
}

/**
 * Move a campaign's full budget from the client's holding account into the campaign, and take the
 * service fee. Fails unless the client has paid budget plus fee: no partial funding.
 */
export async function fundCampaign(store: MoneyStore, i: { campaignId: string; actorId: string | null }) {
  return store.transaction(async (tx) => {
    const c = await tx.campaign(i.campaignId)
    if (!c) throw new MoneyError('not_found', 'No such campaign')
    const feeBps = await tx.clientServiceFeeBps(c.clientId)
    if (feeBps === null) throw new MoneyError('not_found', 'No such client')
    const budgetKey = `campaign_funded:${c.id}`
    const [budget, hold, revenue] = await tx.lockAccounts([
      account.budget(c.id),
      account.holding(c.clientId),
      account.revenue(),
    ])
    if (await tx.transactionExists(budgetKey))
      return { budgetCents: c.budgetCents, feeCents: serviceFeeCents(c.budgetCents, feeBps), alreadyFunded: true }
    const feeCents = serviceFeeCents(c.budgetCents, feeBps)
    const held = await tx.balance(hold!)
    if (held < c.budgetCents + feeCents)
      throw new MoneyError(
        'insufficient_client_funds',
        `The client has ${held} cents available; this campaign needs ${c.budgetCents + feeCents}`,
      )
    await post(tx, { kind: 'campaign_funded', idempotencyKey: budgetKey, campaignId: c.id, createdBy: i.actorId }, [
      { id: hold!, amountCents: -c.budgetCents },
      { id: budget!, amountCents: c.budgetCents },
    ])
    if (feeCents > 0)
      await post(
        tx,
        { kind: 'service_fee_taken', idempotencyKey: `service_fee:${c.id}`, campaignId: c.id, createdBy: i.actorId },
        [
          { id: hold!, amountCents: -feeCents },
          { id: revenue!, amountCents: feeCents },
        ],
      )
    if (i.actorId)
      await tx.audit({
        actorId: i.actorId,
        action: 'campaign.fund',
        entity: 'campaign',
        entityId: c.id,
        after: { budgetCents: c.budgetCents, feeCents },
      })
    return { budgetCents: c.budgetCents, feeCents, alreadyFunded: false }
  })
}

// ---------- Earnings ----------

const EARNING_STATES = ['approved', 'earning']
// Corrections down (views falling) still apply once a post is final and its campaign has closed.
const CORRECTION_STATES = ['approved', 'earning', 'final']

/**
 * Recompute what a post has earned from its total counted views and post the difference
 * (02_DATA_AND_MONEY.md section 5.2). Running it again with the same views changes nothing.
 */
export async function accrueEarnings(store: MoneyStore, i: { submissionId: string }) {
  return store.transaction(async (tx) => {
    const peek = await tx.submission(i.submissionId, false)
    if (!peek) throw new MoneyError('not_found', 'No such submission')
    const [budgetId] = await tx.lockAccounts([account.budget(peek.campaignId)])
    const s = (await tx.submission(i.submissionId, true))!
    const c = (await tx.campaign(s.campaignId))!
    const [pendingId] = await tx.lockAccounts([account.pending(s.creatorId)])

    const budgetBalance = await tx.balance(budgetId!)
    const r = postEarnings({
      countedViews: s.countedViews,
      rateCentsPer1000Locked: s.rateCentsPer1000Locked,
      minViewsToEarn: c.minViewsToEarn,
      capPerPostCents: c.capPerPostCents,
      capPerCreatorCents: c.capPerCreatorCents,
      creatorEarnedElsewhereCents: await tx.creatorEarnedInCampaign(s.creatorId, c.id, s.id),
      campaignBudgetBalanceCents: budgetBalance,
      earnedCentsAlready: s.earnedCents,
    })

    let delta = r.deltaCents
    // Earnings only grow while the post is approved and the campaign is live.
    if (delta > 0 && !(EARNING_STATES.includes(s.state) && c.status === 'live')) delta = 0
    if (delta < 0 && !CORRECTION_STATES.includes(s.state)) delta = 0

    // "Earning" means approved with counted views at or past the minimum (01_PRODUCT.md section 7).
    const nextState =
      s.state === 'approved' && s.countedViews > 0 && s.countedViews >= c.minViewsToEarn ? 'earning' : s.state
    let transactionId: string | null = null
    if (delta !== 0) {
      const seq = await tx.countSubmissionTransactions(s.id)
      const kind = delta > 0 ? 'earning_accrued' : 'earning_reversed'
      const res = await post(
        tx,
        {
          kind,
          idempotencyKey: `submission:${s.id}:${seq}`,
          campaignId: c.id,
          submissionId: s.id,
          creatorId: s.creatorId,
        },
        [
          { id: budgetId!, amountCents: -delta },
          { id: pendingId!, amountCents: delta },
        ],
      )
      transactionId = res.id
      await tx.setSubmission(s.id, { earnedCents: s.earnedCents + delta, state: nextState })
    } else if (nextState !== s.state) {
      await tx.setSubmission(s.id, { state: nextState })
    }

    // The campaign closes for new earnings once no further cent can be paid (section 5.3).
    const after = budgetBalance - delta
    let campaignClosing = false
    if (c.status === 'live' && after < 1) {
      await tx.setCampaignStatus(c.id, 'closing')
      campaignClosing = true
    }
    return { rawCents: r.rawCents, postCents: s.earnedCents + delta, deltaCents: delta, transactionId, campaignClosing }
  })
}

/** Take back everything a post has earned (rejected or removed). Section 5.5. */
export async function reverseEarnings(store: MoneyStore, i: { submissionId: string; actorId: string | null }) {
  return store.transaction(async (tx) => {
    const peek = await tx.submission(i.submissionId, false)
    if (!peek) throw new MoneyError('not_found', 'No such submission')
    const [budgetId] = await tx.lockAccounts([account.budget(peek.campaignId)])
    const s = (await tx.submission(i.submissionId, true))!
    const [pendingId] = await tx.lockAccounts([account.pending(s.creatorId)])
    if (s.earnedCents === 0) return { reversedCents: 0, transactionId: null }
    if (s.state === 'paid_out')
      throw new MoneyError('nothing_to_reverse', 'Released earnings are not reversed automatically. Staff decide.')
    const seq = await tx.countSubmissionTransactions(s.id)
    const res = await post(
      tx,
      {
        kind: 'earning_reversed',
        idempotencyKey: `submission:${s.id}:${seq}`,
        campaignId: s.campaignId,
        submissionId: s.id,
        creatorId: s.creatorId,
        createdBy: i.actorId,
      },
      [
        { id: pendingId!, amountCents: -s.earnedCents },
        { id: budgetId!, amountCents: s.earnedCents },
      ],
    )
    await tx.setSubmission(s.id, { earnedCents: 0 })
    return { reversedCents: s.earnedCents, transactionId: res.id }
  })
}

/** Move a final post's earnings from pending to available and mark it paid out (section 5.4). */
export async function releaseEarnings(store: MoneyStore, i: { submissionId: string }) {
  return store.transaction(async (tx) => {
    const s = await tx.submission(i.submissionId, true)
    if (!s) throw new MoneyError('not_found', 'No such submission')
    if (s.state === 'paid_out') return { releasedCents: 0, alreadyReleased: true }
    if (s.state !== 'final') throw new MoneyError('not_releasable', 'Only final submissions can be released')
    if (await tx.hasOpenFlagOrAppeal(s.id))
      throw new MoneyError('not_releasable', 'An open flag or appeal holds this release')
    const [pendingId, availableId] = await tx.lockAccounts([
      account.pending(s.creatorId),
      account.available(s.creatorId),
    ])
    if (s.earnedCents > 0)
      await post(
        tx,
        {
          kind: 'earnings_released',
          idempotencyKey: `release:${s.id}`,
          campaignId: s.campaignId,
          submissionId: s.id,
          creatorId: s.creatorId,
        },
        [
          { id: pendingId!, amountCents: -s.earnedCents },
          { id: availableId!, amountCents: s.earnedCents },
        ],
      )
    await tx.setSubmission(s.id, { state: 'paid_out' })
    return { releasedCents: s.earnedCents, alreadyReleased: false }
  })
}

// ---------- Withdrawals ----------

/** A creator asks to withdraw. The fee and net come from the same quote the form shows (section 6). */
export async function requestWithdrawal(
  store: MoneyStore,
  i: { creatorId: string; amountCents: number; method: 'stripe_connect' | 'paypal' },
) {
  return store.transaction(async (tx) => {
    const creator = await tx.lockCreator(i.creatorId)
    if (!creator) throw new MoneyError('not_found', 'No such creator')
    if (creator.userStatus !== 'active')
      throw new MoneyError('creator_suspended', 'This account cannot withdraw right now')
    if (creator.payoutStatus !== 'verified')
      throw new MoneyError('payout_not_verified', 'Finish the payout setup and identity check first')
    const q = withdrawalQuote(i.amountCents, await tx.feeSettings())
    if (!q.ok) throw new MoneyError(q.code, q.message)
    if (await tx.hasRequestedWithdrawal(i.creatorId))
      throw new MoneyError('withdrawal_already_requested', 'You already have a withdrawal waiting for review')
    const [availableId, transitId] = await tx.lockAccounts([account.available(i.creatorId), account.inTransit()])
    const available = await tx.balance(availableId!)
    if (available < q.amountCents)
      throw new MoneyError('insufficient_available', 'That is more than your available balance')
    const id = await tx.insertWithdrawal({
      creatorId: i.creatorId,
      method: i.method,
      amountCents: q.amountCents,
      feeCents: q.feeCents,
      netCents: q.netCents,
    })
    await post(
      tx,
      {
        kind: 'withdrawal_requested',
        idempotencyKey: `withdrawal_requested:${id}`,
        creatorId: i.creatorId,
        payoutId: id,
      },
      [
        { id: availableId!, amountCents: -q.amountCents },
        { id: transitId!, amountCents: q.amountCents },
      ],
    )
    return { id, amountCents: q.amountCents, feeCents: q.feeCents, netCents: q.netCents, status: 'requested' as const }
  })
}

const SENT_STATES = ['in_batch', 'sent']

/** The payout partner confirms payment. Only now is the fee taken (section 4). */
export async function markWithdrawalPaid(
  store: MoneyStore,
  i: { withdrawalId: string; partnerReference: string; actorId: string | null },
) {
  return store.transaction(async (tx) => {
    const w = await tx.withdrawal(i.withdrawalId, true)
    if (!w) throw new MoneyError('not_found', 'No such withdrawal')
    if (w.status === 'paid') return { alreadyDone: true }
    if (!SENT_STATES.includes(w.status))
      throw new MoneyError('wrong_withdrawal_status', `A ${w.status} withdrawal cannot be marked paid`)
    const [transitId, extId, revenueId] = await tx.lockAccounts([
      account.inTransit(),
      account.external(),
      account.revenue(),
    ])
    await post(
      tx,
      {
        kind: 'withdrawal_paid',
        idempotencyKey: `withdrawal_paid:${w.id}`,
        creatorId: w.creatorId,
        payoutId: w.id,
        createdBy: i.actorId,
      },
      [
        { id: transitId!, amountCents: -w.amountCents },
        { id: extId!, amountCents: w.netCents },
        { id: revenueId!, amountCents: w.feeCents },
      ],
    )
    await tx.setWithdrawal(w.id, { status: 'paid', partnerReference: i.partnerReference })
    if (i.actorId)
      await tx.audit({
        actorId: i.actorId,
        action: 'withdrawal.paid',
        entity: 'withdrawal',
        entityId: w.id,
        before: { status: w.status },
        after: { status: 'paid' },
      })
    return { alreadyDone: false }
  })
}

/** The payout failed. The full amount goes back to available and no fee is taken. */
export async function markWithdrawalFailed(
  store: MoneyStore,
  i: { withdrawalId: string; reason: string; actorId: string | null },
) {
  return store.transaction(async (tx) => {
    const w = await tx.withdrawal(i.withdrawalId, true)
    if (!w) throw new MoneyError('not_found', 'No such withdrawal')
    if (w.status === 'failed') return { alreadyDone: true }
    if (!SENT_STATES.includes(w.status))
      throw new MoneyError('wrong_withdrawal_status', `A ${w.status} withdrawal cannot be marked failed`)
    const [availableId, transitId] = await tx.lockAccounts([account.available(w.creatorId), account.inTransit()])
    await post(
      tx,
      {
        kind: 'withdrawal_failed',
        idempotencyKey: `withdrawal_failed:${w.id}`,
        creatorId: w.creatorId,
        payoutId: w.id,
        createdBy: i.actorId,
      },
      [
        { id: transitId!, amountCents: -w.amountCents },
        { id: availableId!, amountCents: w.amountCents },
      ],
    )
    await tx.setWithdrawal(w.id, { status: 'failed', failureReason: i.reason })
    if (i.actorId)
      await tx.audit({
        actorId: i.actorId,
        action: 'withdrawal.failed',
        entity: 'withdrawal',
        entityId: w.id,
        before: { status: w.status },
        after: { status: 'failed', reason: i.reason },
      })
    return { alreadyDone: false }
  })
}

// ---------- Closing and corrections ----------

/** Unused budget goes back to the client's holding account once the campaign has closed (section 5.4). */
export async function returnCampaignRemainder(store: MoneyStore, i: { campaignId: string }) {
  return store.transaction(async (tx) => {
    const c = await tx.campaign(i.campaignId)
    if (!c) throw new MoneyError('not_found', 'No such campaign')
    if (c.status !== 'closed')
      throw new MoneyError('campaign_not_closed', 'The remainder is returned only after the campaign closes')
    const [budgetId, holdId] = await tx.lockAccounts([account.budget(c.id), account.holding(c.clientId)])
    const remainder = await tx.balance(budgetId!)
    if (remainder === 0) return { returnedCents: 0 }
    // Money can come back into a closed budget later (a held post reversed by staff), so each return
    // has its own number. The budget is locked above, so two runs agree on the number and post once.
    const n = await tx.countCampaignTransactions(c.id, 'campaign_remainder_returned')
    const r = await post(
      tx,
      {
        kind: 'campaign_remainder_returned',
        idempotencyKey: n === 0 ? `remainder:${c.id}` : `remainder:${c.id}:${n}`,
        campaignId: c.id,
      },
      [
        { id: budgetId!, amountCents: -remainder },
        { id: holdId!, amountCents: remainder },
      ],
    )
    return { returnedCents: r.created ? remainder : 0 }
  })
}

/** A finance correction: move an amount from one account to another, with a reason. Audited. */
export async function manualAdjustment(
  store: MoneyStore,
  i: { from: AccountRef; to: AccountRef; amountCents: number; memo: string; actorId: string; idempotencyKey: string },
) {
  assertWhole(i.amountCents, 'Amount')
  if (i.amountCents <= 0) throw new MoneyError('not_whole_cents', 'The amount must be more than zero')
  if (!i.memo.trim()) throw new MoneyError('memo_required', 'A manual adjustment needs a reason')
  if (!i.actorId) throw new MoneyError('actor_required', 'A manual adjustment needs the staff member who made it')
  return store.transaction(async (tx) => {
    const [fromId, toId] = await tx.lockAccounts([i.from, i.to])
    if (GUARDED_KINDS.includes(i.from.kind) && (await tx.balance(fromId!)) < i.amountCents)
      throw new MoneyError('insufficient_balance', 'That account does not hold enough for this adjustment')
    const r = await post(
      tx,
      {
        kind: 'manual_adjustment',
        idempotencyKey: `adjustment:${i.idempotencyKey}`,
        memo: i.memo,
        createdBy: i.actorId,
      },
      [
        { id: fromId!, amountCents: -i.amountCents },
        { id: toId!, amountCents: i.amountCents },
      ],
    )
    if (r.created)
      await tx.audit({
        actorId: i.actorId,
        action: 'ledger.adjustment',
        entity: 'ledger_transaction',
        entityId: r.id,
        after: { from: i.from, to: i.to, amountCents: i.amountCents, memo: i.memo },
      })
    return r
  })
}

/** Re-post an existing transaction by its idempotency key. Used by tests to prove replays change nothing. */
export async function replayTransaction(
  store: MoneyStore,
  t: { kind: string; idempotencyKey: string; entries: Entry[] },
) {
  return store.transaction((tx) =>
    tx.insertTransaction({ kind: t.kind as NewTransaction['kind'], idempotencyKey: t.idempotencyKey }, t.entries),
  )
}
