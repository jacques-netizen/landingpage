// Crypto withdrawals (owner request, 2026-10-08): the creator asks to withdraw to their wallet, staff
// verify the request, send the crypto, and mark it paid with the transaction hash; or reject it, which
// returns the full amount to the creator's available balance. All amounts are whole cents.
import { tables } from '@mde/db'
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import {
  accrueEarnings,
  approveWithdrawal,
  markWithdrawalFailed,
  markWithdrawalPaid,
  releaseEarnings,
  requestWithdrawal,
} from '../src'
import { balanceOf, connect, fundedCampaign, makeSubmission, makeUser } from './fixtures'

const ctx = connect()
const { db, store } = ctx
afterAll(() => ctx.client.end())

const WALLET = 'USDT|tron|TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE'

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

describe('crypto withdrawals', () => {
  it('records the wallet with the request and moves the amount out of the available balance', async () => {
    const creator = await creatorWithBalance()
    const w = await requestWithdrawal(store, {
      creatorId: creator,
      amountCents: 6_000,
      method: 'crypto',
      destination: WALLET,
    })
    expect(w.status).toBe('requested')
    expect(await withdrawal(w.id)).toMatchObject({ method: 'crypto', destination: WALLET, status: 'requested' })
    expect(await balanceOf(db, 'creator_available', creator)).toBe(4_000)
  })

  it('is verified, then marked paid with the transaction hash', async () => {
    const creator = await creatorWithBalance()
    const w = await requestWithdrawal(store, {
      creatorId: creator,
      amountCents: 10_000,
      method: 'crypto',
      destination: WALLET,
    })
    const transitBefore = await balanceOf(db, 'payout_in_transit', null)
    await approveWithdrawal(store, { withdrawalId: w.id, actorId: null })
    expect((await withdrawal(w.id)).status).toBe('approved')
    await markWithdrawalPaid(store, { withdrawalId: w.id, partnerReference: '0xabc123', actorId: null })
    expect(await withdrawal(w.id)).toMatchObject({ status: 'paid', partnerReference: '0xabc123' })
    expect(await balanceOf(db, 'payout_in_transit', null)).toBe(transitBefore - 10_000)
    expect(await balanceOf(db, 'creator_available', creator)).toBe(0)
  })

  it('cannot be marked paid before it is verified', async () => {
    const creator = await creatorWithBalance()
    const w = await requestWithdrawal(store, {
      creatorId: creator,
      amountCents: 5_000,
      method: 'crypto',
      destination: WALLET,
    })
    await expect(
      markWithdrawalPaid(store, { withdrawalId: w.id, partnerReference: '0x1', actorId: null }),
    ).rejects.toMatchObject({ code: 'wrong_withdrawal_status' })
  })

  it('returns the full amount when rejected, before or after verifying, and takes no fee', async () => {
    for (const verifyFirst of [false, true]) {
      const creator = await creatorWithBalance()
      const revenueBefore = await balanceOf(db, 'platform_revenue', null)
      const w = await requestWithdrawal(store, {
        creatorId: creator,
        amountCents: 10_000,
        method: 'crypto',
        destination: WALLET,
      })
      if (verifyFirst) await approveWithdrawal(store, { withdrawalId: w.id, actorId: null })
      await markWithdrawalFailed(store, { withdrawalId: w.id, reason: 'Wallet address does not exist', actorId: null })
      expect(await withdrawal(w.id)).toMatchObject({ status: 'failed', failureReason: 'Wallet address does not exist' })
      expect(await balanceOf(db, 'creator_available', creator)).toBe(10_000)
      expect(await balanceOf(db, 'platform_revenue', null)).toBe(revenueBefore)
    }
  })

  it('verifies only a waiting request, and verifying twice changes nothing', async () => {
    const creator = await creatorWithBalance()
    const w = await requestWithdrawal(store, {
      creatorId: creator,
      amountCents: 5_000,
      method: 'crypto',
      destination: WALLET,
    })
    await approveWithdrawal(store, { withdrawalId: w.id, actorId: null })
    await approveWithdrawal(store, { withdrawalId: w.id, actorId: null })
    expect((await withdrawal(w.id)).status).toBe('approved')
    await markWithdrawalPaid(store, { withdrawalId: w.id, partnerReference: '0x2', actorId: null })
    await expect(approveWithdrawal(store, { withdrawalId: w.id, actorId: null })).rejects.toMatchObject({
      code: 'wrong_withdrawal_status',
    })
  })

  it('needs a wallet for a crypto withdrawal', async () => {
    const creator = await creatorWithBalance()
    await expect(
      requestWithdrawal(store, { creatorId: creator, amountCents: 5_000, method: 'crypto', destination: '' }),
    ).rejects.toMatchObject({ code: 'payout_not_verified' })
  })
})
