import { describe, expect, it } from 'vitest'
import { clientFundingTotal, serviceFee, withdrawalQuote } from './fees'

describe('client service fee (docs/02 section 4)', () => {
  it('case 10: 1,000 bps on a budget of 100,000 is 10,000 and the client pays 110,000', () => {
    expect(serviceFee(100_000n, 1_000)).toBe(10_000n)
    expect(clientFundingTotal(100_000n, 1_000)).toBe(110_000n)
  })
  it('rounds half up', () => {
    expect(serviceFee(1_005n, 100)).toBe(10n) // 10.05 rounds to 10
    expect(serviceFee(1_050n, 100)).toBe(11n) // 10.50 rounds up to 11
    expect(serviceFee(1_049n, 100)).toBe(10n) // 10.49 rounds down to 10
  })
  it('is zero at zero bps', () => {
    expect(serviceFee(100_000n, 0)).toBe(0n)
  })
})

describe('withdrawal quote (docs/02 section 6)', () => {
  const settings = { feeBps: 500, feeMinCents: 300 }
  it('case 11: 10,000 with 500 bps and a 300 minimum fee has fee 500 and net 9,500', () => {
    expect(withdrawalQuote(10_000n, settings)).toEqual({
      amountCents: 10_000n,
      feeCents: 500n,
      netCents: 9_500n,
    })
  })
  it('case 12: 3,000 with 500 bps and a 300 minimum fee has fee 300 and net 2,700', () => {
    expect(withdrawalQuote(3_000n, settings)).toEqual({
      amountCents: 3_000n,
      feeCents: 300n,
      netCents: 2_700n,
    })
  })
  it('is free at zero bps and zero minimum', () => {
    expect(withdrawalQuote(2_500n, { feeBps: 0, feeMinCents: 0 }).feeCents).toBe(0n)
  })
  it('rounds the fee half up', () => {
    expect(withdrawalQuote(1_050n, { feeBps: 100, feeMinCents: 0 }).feeCents).toBe(11n)
  })
  it('refuses a fee larger than the amount', () => {
    expect(() => withdrawalQuote(200n, settings)).toThrow()
  })
  it('refuses amounts that are not positive', () => {
    expect(() => withdrawalQuote(0n, settings)).toThrow()
    expect(() => withdrawalQuote(-5n, settings)).toThrow()
  })
})
