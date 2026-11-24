// Whop payouts (owner, 2026-11-24: "deposit the money in the platform through Whop and pay out the
// creators through that"). A clipper with a Whop payout account asks to withdraw, staff verify it, the
// platform sends a Whop transfer and records it as sent with the transfer id, and Whop's confirmation
// marks it paid (fee to revenue) or failed (the full amount back to the clipper). Whole cents only.
import { tables } from '@mde/db'
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import {
  accrueEarnings,
  approveWithdrawal,
  markWithdrawalFailed,
  markWithdrawalPaid,
  markWithdrawalSent,
  releaseEarnings,
  requestWithdrawal,
} from '../src'
import { balanceOf, connect, fundedCampaign, makeSubmission, makeUser } from './fixtures'

const ctx = connect()
const { db, store } = ctx
afterAll(() => ctx.client.end())

const WHOP = 'whop:biz_test123'

/** A verified creator with $100.00 available. */
async function creatorWithBalance() {
  const c = await fundedCampaign(ctx)
  const creator = await makeUser(db, { payoutStatus: 'verified' })
  const s = await makeSubmission(db, c, creator, { countedViews: 50_000 })
  await accrueEarnings(store, { submissionId: s })
  await db.update(tables.submissions).set({ state: 'final' }).where(eq(tables.submissions.id, s))
  await releaseEarnings(store, { submissionId: s })
  return creator
}

async function withdrawal(id: string) {
  const [w] = await db.select().from(tables.withdrawals).where(eq(tables.withdrawals.id, id))
  return w!
}

describe('Whop withdrawals', () => {
  it('needs the Whop account as the destination', async () => {
    const creator = await creatorWithBalance()
    await expect(requestWithdrawal(store, { creatorId: creator, amountCents: 5_000, method: 'whop' })).rejects.toThrow(
      /where to send it/i,
    )
  })

  it('is requested, verified, sent with the transfer id, then paid', async () => {
    const creator = await creatorWithBalance()
    const w = await requestWithdrawal(store, {
      creatorId: creator,
      amountCents: 10_000,
      method: 'whop',
      destination: WHOP,
    })
    expect(await withdrawal(w.id)).toMatchObject({ method: 'whop', destination: WHOP, status: 'requested' })
    // Not sent before staff verify it.
    await expect(
      markWithdrawalSent(store, { withdrawalId: w.id, partnerReference: 'ctt_1', actorId: null }),
    ).rejects.toThrow(/cannot be marked sent/i)
    const staff = await makeUser(db)
    await approveWithdrawal(store, { withdrawalId: w.id, actorId: staff })
    await markWithdrawalSent(store, { withdrawalId: w.id, partnerReference: 'ctt_1', actorId: staff })
    expect(await withdrawal(w.id)).toMatchObject({ status: 'sent', partnerReference: 'ctt_1' })
    expect(await balanceOf(db, 'payout_in_transit', null)).toBeGreaterThanOrEqual(10_000)
    // Sending again changes nothing.
    expect(
      (await markWithdrawalSent(store, { withdrawalId: w.id, partnerReference: 'ctt_1', actorId: null })).alreadyDone,
    ).toBe(true)
    await markWithdrawalPaid(store, { withdrawalId: w.id, partnerReference: 'ctt_1', actorId: null })
    expect((await withdrawal(w.id)).status).toBe('paid')
    expect(await balanceOf(db, 'creator_available', creator)).toBe(0)
  })

  it('a failed transfer returns the full amount to the clipper', async () => {
    const creator = await creatorWithBalance()
    const w = await requestWithdrawal(store, {
      creatorId: creator,
      amountCents: 4_000,
      method: 'whop',
      destination: WHOP,
    })
    await approveWithdrawal(store, { withdrawalId: w.id, actorId: null })
    await markWithdrawalSent(store, { withdrawalId: w.id, partnerReference: 'ctt_2', actorId: null })
    await markWithdrawalFailed(store, { withdrawalId: w.id, reason: 'Whop: transfer failed', actorId: null })
    expect((await withdrawal(w.id)).status).toBe('failed')
    expect(await balanceOf(db, 'creator_available', creator)).toBe(10_000)
  })
})
