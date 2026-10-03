import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { computePostEarnings } from './earnings'
import { serviceFee, withdrawalQuote } from './fees'
import { formatUsd } from './format'

const RUNS = 10_000

const big = (max: number) => fc.bigInt({ min: 0n, max: BigInt(max) })
const earningsInput = fc.record({
  countedViews: fc.integer({ min: 0, max: 50_000_000 }),
  rateCentsPer1000: fc.integer({ min: 1, max: 100_000 }),
  minViewsToEarn: fc.option(fc.integer({ min: 0, max: 100_000 }), { nil: null }),
  capPerPostCents: fc.option(big(10_000_000), { nil: null }),
  capPerCreatorCents: fc.option(big(50_000_000), { nil: null }),
  creatorEarnedElsewhereCents: big(50_000_000),
  budgetBalanceCents: big(1_000_000_000),
  alreadyEarnedCents: big(10_000_000),
  acceptingNewEarnings: fc.boolean(),
})

describe('earnings properties (10,000 random runs each)', () => {
  it('a post never earns a negative amount, more than floor(views * rate / 1000), or more than its caps', () => {
    fc.assert(
      fc.property(earningsInput, (i) => {
        const r = computePostEarnings(i)
        expect(r.postCents >= 0n).toBe(true)
        expect(r.postCents <= r.rawCents).toBe(true)
        expect(r.postCents * 1000n <= BigInt(i.countedViews) * BigInt(i.rateCentsPer1000)).toBe(
          true,
        )
        if (i.capPerPostCents != null) expect(r.postCents <= i.capPerPostCents).toBe(true)
      }),
      { numRuns: RUNS },
    )
  })

  it('the budget is never overspent: paying the delta never takes a non-negative balance below zero', () => {
    fc.assert(
      fc.property(earningsInput, (i) => {
        const r = computePostEarnings(i)
        // Corrections down add to the budget. Increases are limited by what it holds.
        if (r.deltaCents > 0n) expect(r.deltaCents <= i.budgetBalanceCents).toBe(true)
        expect(r.budgetAfterCents >= 0n).toBe(true)
      }),
      { numRuns: RUNS },
    )
  })

  it('the creator cap holds across posts', () => {
    fc.assert(
      fc.property(earningsInput, (i) => {
        if (i.capPerCreatorCents == null || !i.acceptingNewEarnings) return
        const r = computePostEarnings(i)
        if (i.creatorEarnedElsewhereCents <= i.capPerCreatorCents) {
          expect(r.postCents + i.creatorEarnedElsewhereCents <= i.capPerCreatorCents).toBe(true)
        } else {
          expect(r.postCents).toBe(0n)
        }
      }),
      { numRuns: RUNS },
    )
  })

  it('more views never lower the earnings of a post while the campaign accepts them', () => {
    fc.assert(
      fc.property(earningsInput, fc.integer({ min: 0, max: 1_000_000 }), (i, more) => {
        const base = computePostEarnings({ ...i, acceptingNewEarnings: true })
        const higher = computePostEarnings({
          ...i,
          countedViews: i.countedViews + more,
          acceptingNewEarnings: true,
        })
        expect(higher.postCents >= base.postCents).toBe(true)
      }),
      { numRuns: RUNS },
    )
  })

  it('running the same input again after posting the delta gives a delta of zero', () => {
    fc.assert(
      fc.property(earningsInput, (i) => {
        const first = computePostEarnings(i)
        const budgetAfter = i.budgetBalanceCents - first.deltaCents
        const second = computePostEarnings({
          ...i,
          alreadyEarnedCents: first.postCents,
          budgetBalanceCents: budgetAfter,
        })
        expect(second.deltaCents).toBe(0n)
      }),
      { numRuns: RUNS },
    )
  })

  it('below the minimum views earns nothing, closing campaigns never grow a post', () => {
    fc.assert(
      fc.property(earningsInput, (i) => {
        const below = computePostEarnings({
          ...i,
          minViewsToEarn: i.countedViews + 1,
          alreadyEarnedCents: 0n,
        })
        expect(below.postCents).toBe(0n)
        const closing = computePostEarnings({ ...i, acceptingNewEarnings: false })
        expect(closing.postCents <= i.alreadyEarnedCents).toBe(true)
      }),
      { numRuns: RUNS },
    )
  })
})

describe('fee properties (10,000 random runs each)', () => {
  it('service fee is within half a cent of the exact value and zero at zero bps', () => {
    fc.assert(
      fc.property(big(10_000_000_000), fc.integer({ min: 0, max: 10_000 }), (budget, bps) => {
        const fee = serviceFee(budget, bps)
        const exact2 = budget * BigInt(bps) * 2n // twice the exact fee scaled by 10,000
        const fee2 = fee * 2n * 10_000n
        const diff = fee2 > exact2 ? fee2 - exact2 : exact2 - fee2
        expect(diff <= 10_000n).toBe(true) // within half a cent
        if (bps === 0) expect(fee).toBe(0n)
      }),
      { numRuns: RUNS },
    )
  })

  it('a withdrawal quote splits the amount exactly into fee and net, and the fee is at least the minimum', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1n, max: 1_000_000_000n }),
        fc.integer({ min: 0, max: 5_000 }),
        fc.integer({ min: 0, max: 2_000 }),
        (amount, feeBps, feeMin) => {
          let q
          try {
            q = withdrawalQuote(amount, { feeBps, feeMinCents: feeMin })
          } catch {
            // Only allowed when the fee would swallow the whole amount.
            expect(
              amount <= BigInt(feeMin) || (amount * BigInt(feeBps) + 5000n) / 10000n >= amount,
            ).toBe(true)
            return
          }
          expect(q.feeCents + q.netCents).toBe(amount)
          expect(q.netCents > 0n).toBe(true)
          expect(q.feeCents >= BigInt(feeMin)).toBe(true)
        },
      ),
      { numRuns: RUNS },
    )
  })
})

describe('formatting property (10,000 random runs)', () => {
  it('formatUsd always parses back to the same whole cents', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: -9_000_000_000_000_000n, max: 9_000_000_000_000_000n }),
        (cents) => {
          const text = formatUsd(cents)
          const m = /^(-?)\$([\d,]+)\.(\d{2})$/.exec(text)
          expect(m).not.toBeNull()
          const back = BigInt(`${m![1]}${m![2]!.replaceAll(',', '')}${m![3]}`)
          expect(back).toBe(cents)
        },
      ),
      { numRuns: RUNS },
    )
  })
})

it('has the constants the plan asks for', () => {
  expect(RUNS).toBe(10_000)
})
