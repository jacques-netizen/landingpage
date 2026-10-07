// Changing a funded campaign's budget (owner request, 2026-10-07). The difference moves between the
// client's held funds and the campaign budget, with the service fee on the difference, as whole cents.
import { afterAll, describe, expect, it } from 'vitest'
import { accrueEarnings, changeCampaignBudget, MoneyError, recordClientFunding, serviceFeeCents } from '../src'
import { balanceOf, campaign, connect, fundedCampaign, makeSubmission, makeUser } from './fixtures'

const ctx = connect()
const { db, store } = ctx
afterAll(() => ctx.client.end())

const FEE = 1_000 // 10%

describe('changing a funded campaign budget', () => {
  it('raises the budget from money the client has paid in, taking the fee on the difference', async () => {
    const c = await fundedCampaign(ctx, { budgetCents: 100_000 }, FEE)
    await recordClientFunding(store, { clientId: c.clientId, amountCents: 55_000, reference: 'top-up', actorId: null })
    const revenueBefore = await balanceOf(db, 'platform_revenue', null)
    const r = await changeCampaignBudget(store, {
      campaignId: c.campaignId,
      budgetCents: 150_000,
      actorId: null,
      requestKey: 'raise-1',
    })
    expect(r).toMatchObject({ fromCents: 100_000, toCents: 150_000, feeChangeCents: 5_000 })
    expect((await campaign(db, c.campaignId)).budgetCents).toBe(150_000)
    expect(await balanceOf(db, 'campaign_budget', c.campaignId)).toBe(150_000)
    expect(await balanceOf(db, 'client_funds_holding', c.clientId)).toBe(0)
    expect((await balanceOf(db, 'platform_revenue', null)) - revenueBefore).toBe(5_000)
  })

  it('refuses a raise the client has not paid for, and changes nothing', async () => {
    const c = await fundedCampaign(ctx, { budgetCents: 100_000 }, FEE)
    await expect(
      changeCampaignBudget(store, { campaignId: c.campaignId, budgetCents: 120_000, actorId: null, requestKey: 'x' }),
    ).rejects.toMatchObject({ code: 'insufficient_client_funds' })
    expect((await campaign(db, c.campaignId)).budgetCents).toBe(100_000)
    expect(await balanceOf(db, 'campaign_budget', c.campaignId)).toBe(100_000)
  })

  it('lowers the budget and returns the unspent difference and its fee to the client', async () => {
    const c = await fundedCampaign(ctx, { budgetCents: 100_000 }, FEE)
    const s = await makeSubmission(db, c, await makeUser(db), { countedViews: 2_500 })
    await accrueEarnings(store, { submissionId: s }) // 500 earned from the budget
    const revenueBefore = await balanceOf(db, 'platform_revenue', null)
    const r = await changeCampaignBudget(store, {
      campaignId: c.campaignId,
      budgetCents: 60_000,
      actorId: null,
      requestKey: 'lower-1',
    })
    expect(r).toMatchObject({ fromCents: 100_000, toCents: 60_000, feeChangeCents: -4_000 })
    expect((await campaign(db, c.campaignId)).budgetCents).toBe(60_000)
    expect(await balanceOf(db, 'campaign_budget', c.campaignId)).toBe(59_500)
    expect(await balanceOf(db, 'client_funds_holding', c.clientId)).toBe(44_000)
    expect((await balanceOf(db, 'platform_revenue', null)) - revenueBefore).toBe(-4_000)
  })

  it('never lowers the budget below what creators have already earned from it', async () => {
    const c = await fundedCampaign(ctx, { budgetCents: 100_000 }, FEE)
    const s = await makeSubmission(db, c, await makeUser(db), { countedViews: 2_500 })
    await accrueEarnings(store, { submissionId: s }) // 500 earned
    await expect(
      changeCampaignBudget(store, { campaignId: c.campaignId, budgetCents: 400, actorId: null, requestKey: 'y' }),
    ).rejects.toMatchObject({ code: 'budget_below_spent' })
    // Exactly what has been spent is allowed: nothing is left to earn.
    await changeCampaignBudget(store, { campaignId: c.campaignId, budgetCents: 500, actorId: null, requestKey: 'z' })
    expect(await balanceOf(db, 'campaign_budget', c.campaignId)).toBe(0)
  })

  it('applies the same request once, even when it is sent twice', async () => {
    const c = await fundedCampaign(ctx, { budgetCents: 100_000 }, 0)
    await recordClientFunding(store, { clientId: c.clientId, amountCents: 20_000, reference: 'again', actorId: null })
    const a = { campaignId: c.campaignId, budgetCents: 110_000, actorId: null, requestKey: 'same' }
    await changeCampaignBudget(store, a)
    await changeCampaignBudget(store, a)
    expect(await balanceOf(db, 'campaign_budget', c.campaignId)).toBe(110_000)
    expect(await balanceOf(db, 'client_funds_holding', c.clientId)).toBe(10_000)
  })

  it('keeps the fee equal to the fee on the whole new budget, rounding included', async () => {
    const c = await fundedCampaign(ctx, { budgetCents: 33_333 }, 1_250)
    const extra = 11_111 + serviceFeeCents(44_444, 1_250) - serviceFeeCents(33_333, 1_250)
    await recordClientFunding(store, { clientId: c.clientId, amountCents: extra, reference: 'r', actorId: null })
    const r = await changeCampaignBudget(store, {
      campaignId: c.campaignId,
      budgetCents: 44_444,
      actorId: null,
      requestKey: 'round',
    })
    expect(r.feeChangeCents).toBe(serviceFeeCents(44_444, 1_250) - serviceFeeCents(33_333, 1_250))
    expect(await balanceOf(db, 'client_funds_holding', c.clientId)).toBe(0)
  })

  it('refuses amounts that are not whole cents above zero', async () => {
    const c = await fundedCampaign(ctx, { budgetCents: 100_000 }, 0)
    for (const budgetCents of [0, -5, 10.5])
      await expect(
        changeCampaignBudget(store, {
          campaignId: c.campaignId,
          budgetCents,
          actorId: null,
          requestKey: `bad${budgetCents}`,
        }),
      ).rejects.toBeInstanceOf(MoneyError)
  })
})
