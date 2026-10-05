// Pure money functions: the worked examples and property tests with 10,000 random runs each.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { countedViews, postEarnings, roundHalfUpBps, serviceFeeCents, withdrawalQuote } from '../src'

const RUNS = { numRuns: 10_000 }
const cents = fc.integer({ min: 0, max: 1_000_000_000_00 })
const views = fc.integer({ min: 0, max: 5_000_000_000 })
const rate = fc.integer({ min: 1, max: 100_000 })
const optCap = fc.option(fc.integer({ min: 0, max: 100_000_000 }), { nil: null })

describe('rounding', () => {
  it('rounds half up for fees', () => {
    expect(roundHalfUpBps(1, 5_000)).toBe(1) // 0.5 -> 1
    expect(roundHalfUpBps(1, 4_999)).toBe(0)
    expect(roundHalfUpBps(3, 5_000)).toBe(2) // 1.5 -> 2
    expect(roundHalfUpBps(100_000, 1_000)).toBe(10_000)
  })

  it('is within half a cent of the exact fee, rounding exact halves up', () => {
    fc.assert(
      fc.property(cents, fc.integer({ min: 0, max: 10_000 }), (a, bps) => {
        const r = BigInt(roundHalfUpBps(a, bps)) * 10_000n
        const exact = BigInt(a) * BigInt(bps)
        return r - 5_000n <= exact && exact < r + 5_000n
      }),
      RUNS,
    )
  })
})

describe('counted views', () => {
  it('never counts views from before submission and is never negative', () => {
    expect(countedViews(12_000, 2_000)).toBe(10_000)
    expect(countedViews(1_000, 2_000)).toBe(0)
    fc.assert(
      fc.property(views, views, (l, b) => countedViews(l, b) === Math.max(0, l - b)),
      RUNS,
    )
  })
})

describe('earnings for one post', () => {
  const input = fc.record({
    countedViews: views,
    rateCentsPer1000Locked: rate,
    minViewsToEarn: fc.integer({ min: 0, max: 100_000 }),
    capPerPostCents: optCap,
    capPerCreatorCents: optCap,
    creatorEarnedElsewhereCents: fc.integer({ min: 0, max: 100_000_000 }),
    campaignBudgetBalanceCents: fc.integer({ min: 0, max: 100_000_000 }),
    earnedCentsAlready: fc.integer({ min: 0, max: 100_000_000 }),
  })

  it('stays within every cap, the budget, and the raw amount, and is a whole number of cents', () => {
    fc.assert(
      fc.property(input, (i) => {
        const r = postEarnings(i)
        const ceilings = [r.rawCents, i.campaignBudgetBalanceCents + i.earnedCentsAlready]
        if (i.capPerPostCents !== null) ceilings.push(i.capPerPostCents)
        if (i.capPerCreatorCents !== null)
          ceilings.push(Math.max(0, i.capPerCreatorCents - i.creatorEarnedElsewhereCents))
        return (
          Number.isSafeInteger(r.postCents) &&
          r.postCents >= 0 &&
          r.postCents <= Math.min(...ceilings) &&
          r.deltaCents === r.postCents - i.earnedCentsAlready
        )
      }),
      RUNS,
    )
  })

  it('pays nothing below the minimum views and floors the division otherwise', () => {
    fc.assert(
      fc.property(input, (i) => {
        const r = postEarnings({
          ...i,
          capPerPostCents: null,
          capPerCreatorCents: null,
          campaignBudgetBalanceCents: 10 ** 12,
        })
        if (i.countedViews < i.minViewsToEarn) return r.postCents === 0
        const exact = BigInt(i.countedViews) * BigInt(i.rateCentsPer1000Locked)
        return BigInt(r.postCents) * 1000n <= exact && exact < (BigInt(r.postCents) + 1n) * 1000n
      }),
      RUNS,
    )
  })

  it('never pays more for fewer views', () => {
    fc.assert(
      fc.property(input, views, (i, more) => {
        const a = postEarnings(i).postCents
        const b = postEarnings({ ...i, countedViews: i.countedViews + more }).postCents
        return b >= a
      }),
      RUNS,
    )
  })
})

describe('fees', () => {
  it('service fee is the budget times the client fee, rounded half up', () => {
    expect(serviceFeeCents(100_000, 1_000)).toBe(10_000)
    expect(serviceFeeCents(12_345, 250)).toBe(309) // 308.625 -> 309
  })

  it('withdrawal quote: fee plus net always equals the amount, and the fee respects the minimum', () => {
    const settings = fc.record({
      withdrawal_fee_bps: fc.integer({ min: 0, max: 2_000 }),
      withdrawal_fee_min_cents: fc.integer({ min: 0, max: 1_000 }),
      withdrawal_min_cents: fc.integer({ min: 0, max: 10_000 }),
    })
    fc.assert(
      fc.property(cents, settings, (amount, s) => {
        const q = withdrawalQuote(amount, s)
        if (!q.ok) return amount < s.withdrawal_min_cents || amount <= s.withdrawal_fee_min_cents || amount <= 0
        return (
          q.feeCents + q.netCents === amount &&
          q.feeCents >= s.withdrawal_fee_min_cents &&
          q.netCents > 0 &&
          q.feeCents === Math.max(s.withdrawal_fee_min_cents, roundHalfUpBps(amount, s.withdrawal_fee_bps))
        )
      }),
      RUNS,
    )
  })

  it('withdrawal quote explains why an amount is refused', () => {
    const s = { withdrawal_fee_bps: 0, withdrawal_fee_min_cents: 0, withdrawal_min_cents: 2_000 }
    expect(withdrawalQuote(1_999, s)).toMatchObject({ ok: false, code: 'below_minimum' })
    expect(withdrawalQuote(2_000, s)).toEqual({ ok: true, amountCents: 2_000, feeCents: 0, netCents: 2_000 })
    expect(withdrawalQuote(12.5, s)).toMatchObject({ ok: false, code: 'not_whole_cents' })
  })

  it('rejects fractional money everywhere', () => {
    expect(() => serviceFeeCents(10.5, 100)).toThrow()
    expect(() =>
      postEarnings({
        countedViews: 1.5,
        rateCentsPer1000Locked: 200,
        minViewsToEarn: 0,
        capPerPostCents: null,
        capPerCreatorCents: null,
        creatorEarnedElsewhereCents: 0,
        campaignBudgetBalanceCents: 0,
        earnedCentsAlready: 0,
      }),
    ).toThrow()
  })
})
