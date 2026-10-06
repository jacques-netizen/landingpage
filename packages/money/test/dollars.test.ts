import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { formatDollars, parseDollarsToCents } from '../src/dollars'

describe('parsing dollars typed by staff', () => {
  it('reads common ways of writing an amount as whole cents', () => {
    expect(parseDollarsToCents('$1,250.00')).toEqual({ ok: true, cents: 125_000 })
    expect(parseDollarsToCents('1250')).toEqual({ ok: true, cents: 125_000 })
    expect(parseDollarsToCents(' 12.5 ')).toEqual({ ok: true, cents: 1_250 })
    expect(parseDollarsToCents('0.07')).toEqual({ ok: true, cents: 7 })
    expect(parseDollarsToCents('$2')).toEqual({ ok: true, cents: 200 })
  })

  it('reads the short ways people type budgets', () => {
    expect(parseDollarsToCents('2000')).toEqual({ ok: true, cents: 200_000 })
    expect(parseDollarsToCents('2k')).toEqual({ ok: true, cents: 200_000 })
    expect(parseDollarsToCents('2K')).toEqual({ ok: true, cents: 200_000 })
    expect(parseDollarsToCents('1.5k')).toEqual({ ok: true, cents: 150_000 })
    expect(parseDollarsToCents('2.345k')).toEqual({ ok: true, cents: 234_500 })
    expect(parseDollarsToCents('$ 2,000')).toEqual({ ok: true, cents: 200_000 })
    expect(parseDollarsToCents('2000 USD')).toEqual({ ok: true, cents: 200_000 })
    expect(parseDollarsToCents('2 000')).toEqual({ ok: true, cents: 200_000 })
    expect(parseDollarsToCents('2000usd')).toEqual({ ok: true, cents: 200_000 })
  })

  it('refuses short forms that would need fractions of a cent', () => {
    for (const bad of ['1.23456k', 'k', '2kk', '2m', '-2k', '2 00'])
      expect(parseDollarsToCents(bad).ok, bad).toBe(false)
  })

  it('refuses anything that is not a whole number of cents', () => {
    for (const bad of ['', '12.345', '-5', '1,2,3.4.5', 'abc', '$', '1e3', '0x10', '12.', '.5.5', '99999999999999999'])
      expect(parseDollarsToCents(bad).ok, bad).toBe(false)
  })

  it('round-trips with the display format for every amount (10,000 runs)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000_000_000 }), (cents) => {
        const r = parseDollarsToCents(formatDollars(cents))
        return r.ok && r.cents === cents
      }),
      { numRuns: 10_000 },
    )
  })

  it('formats cents as dollars', () => {
    expect(formatDollars(480_000)).toBe('$4,800.00')
    expect(formatDollars(5)).toBe('$0.05')
  })
})
