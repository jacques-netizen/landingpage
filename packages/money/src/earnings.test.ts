import { describe, expect, it } from 'vitest'
import { computePostEarnings, type EarningsInput } from './earnings'

/** Setup A from docs/02_DATA_AND_MONEY.md section 7. All amounts are cents. */
const A: Omit<EarningsInput, 'countedViews'> = {
  rateCentsPer1000: 200,
  minViewsToEarn: 1000,
  capPerPostCents: 30_000n,
  capPerCreatorCents: 50_000n,
  creatorEarnedElsewhereCents: 0n,
  budgetBalanceCents: 100_000n,
  alreadyEarnedCents: 0n,
  acceptingNewEarnings: true,
}
const run = (countedViews: number, over: Partial<EarningsInput> = {}) =>
  computePostEarnings({ ...A, countedViews, ...over })

describe('earnings for one post (docs/02 section 5.2)', () => {
  it('case 1: 800 counted views is below the minimum and earns 0', () => {
    expect(run(800).postCents).toBe(0n)
  })

  it('case 2: 2,500 counted views earn floor(2500 * 200 / 1000) = 500', () => {
    const r = run(2_500)
    expect(r.rawCents).toBe(500n)
    expect(r.postCents).toBe(500n)
    expect(r.deltaCents).toBe(500n)
  })

  it('case 3: 250,000 counted views are capped at 30,000 per post', () => {
    const r = run(250_000)
    expect(r.rawCents).toBe(50_000n)
    expect(r.postCents).toBe(30_000n)
  })

  it('case 4: second post is limited by what is left under the creator cap', () => {
    const r = run(200_000, { creatorEarnedElsewhereCents: 30_000n })
    expect(r.rawCents).toBe(40_000n)
    expect(r.postCents).toBe(20_000n)
  })

  it('case 5: views falling from 10,000 to 9,000 give a delta of -200', () => {
    const first = run(10_000)
    expect(first.postCents).toBe(2_000n)
    const down = run(9_000, { alreadyEarnedCents: first.postCents })
    expect(down.postCents).toBe(1_800n)
    expect(down.deltaCents).toBe(-200n)
  })

  it('case 6: with 5,000 left and 8,000 owed, the post earns 5,000', () => {
    const r = run(40_000, {
      budgetBalanceCents: 5_000n,
      capPerPostCents: null,
      capPerCreatorCents: null,
    })
    expect(r.rawCents).toBe(8_000n)
    expect(r.postCents).toBe(5_000n)
    expect(r.budgetExhausted).toBe(true)
  })

  it('the post already earned counts toward what the budget can still pay it', () => {
    // 2,000 already earned, 1,000 left in the budget: the post can reach 3,000.
    const r = run(50_000, {
      alreadyEarnedCents: 2_000n,
      budgetBalanceCents: 1_000n,
      capPerPostCents: null,
      capPerCreatorCents: null,
    })
    expect(r.postCents).toBe(3_000n)
    expect(r.deltaCents).toBe(1_000n)
  })

  it('uses floor, so no money is created by rounding', () => {
    // 1,999 views at 200 per 1,000 = 399.8 cents, floored to 399.
    expect(run(1_999).postCents).toBe(399n)
  })

  it('stops growing when the campaign is closing or closed, but still corrects down', () => {
    expect(run(50_000, { acceptingNewEarnings: false, alreadyEarnedCents: 500n }).postCents).toBe(
      500n,
    )
    expect(run(2_500, { acceptingNewEarnings: false, alreadyEarnedCents: 2_000n }).postCents).toBe(
      500n,
    )
  })

  it('never goes negative when the creator cap is already used up', () => {
    expect(run(100_000, { creatorEarnedElsewhereCents: 60_000n }).postCents).toBe(0n)
  })
})
